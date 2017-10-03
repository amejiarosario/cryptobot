const { MongoClient } = require('mongodb');

/**
 *
 * This migration is need for the simulator because:
 * - It needs to have a timestamp field to get ticks so it can filter by time ranges
 *
 * Other issues:
 *
 * - Weeks timestamp breaks when it has multiple months. e.g Aug/week35, Sep/week35
 * - Make values and array instead of an object.
 * - Ticks.time should be ISODate
 *
 *

 {
    "_id" : ObjectId("59bd7624811ccd711d1e39e5"),
    "timestamp": ISODate("2017-09-16T19:06:00Z") +++ new (add index and group by date rather) --- new ISODate(""+yr+"-"+mo+"-01T00:00:00Z");
    "time" : "2017/Sep(37)16+19:06", --- remove
    "week": "2017-W37" +++ add
    "high" : 52.99,
    "low" : 52.85,
    "open" : 52.99,
    "count" : 50,
    "volume" : 627.35290511,
    "bought" : 590.30711696,
    "sold" : 37.04578815,
    "close" : 52.33,
    "openTick": {
      "_id" : 514496186,
      "price" : 52.34,
      "side" : "sell",
      "size" : 0.00019048,
      "time" : "2017-09-16T19:56:02.042000Z"
    }
    "closeTick": {
        "_id" : 514496851,
        "price" : 52.33,
        "side" : "buy",
        "size" : 3.45682,
        "time" : "2017-09-16T19:56:20.480000Z"
      }
    "ticks": [ +++--- change 'values' for 'ticks'
      {
        "_id" : 514496186,
        "price" : 52.34,
        "side" : "sell",
        "size" : 0.00019048,
        "time" : "2017-09-16T19:56:02.042000Z"
      },
      {
        "_id" : 514496186,
        "price" : 52.34,
        "side" : "sell",
        "size" : 0.00019048,
        "time" : "2017-09-16T19:56:02.042000Z"
      }
    ]

 }
 */

const VERSION = 1;
const DATABASES = ['mongodb://localhost:27017/crybackup'];

//
// minutes
//

const PAIRS = ['gdax.ltc-usd'];
const TIMEFRAMES = ['minutes'];
// const currentVersion = null;

async function runMigration(version, databases, pairs, timeframes) {
  const collections = pairs.map(p => timeframes.map(t => `${p}-${t}`)).reduce((a, e) => a.concat(e), []);
  const pipelines = [];

  console.log('Collections', JSON.stringify(collections));

  databases.forEach(uri => {
    collections.forEach(collection => {
      const promise = runPipeline(uri, collection, version);
      pipelines.push(promise);
    });
  });

  return Promise.all(pipelines);
}

async function runPipeline(uri, name, version) {
  const db = await MongoClient.connect(uri);
  const collection = db.collection(name);
  const out = `${name}-${version}`;
  await aggregateTicksData(collection, name, version, out);
  const result = await addTimestampAndWeek(out, db);
  db.close();
  return result;
}

async function addTimestampAndWeek(outCollection, db) {
  const collection = db.collection(outCollection);

  return new Promise(resolve => {
    collection.find({}).forEach(d => {
      const ts = new Date(d.openTick.time);
      ts.setMilliseconds(0);
      ts.setSeconds(0);

      collection.update(d, { $set: { timestamp: ts } });
    }, resolve);
  });
}

async function aggregateTicksData(collection, name, version, outCollection) {
  const convertValuesObjectToTicksArray = {
    $addFields: {
      ticks: { $map: { input: { $objectToArray: '$values' }, as: 'tick', in: '$$tick.v' } }
    }
  };

  const addTicks = {
    $addFields: {
      openTick: { $arrayElemAt: ['$ticks', 0] },
      closeTick: { $arrayElemAt: ['$ticks', -1] },
    }
  }

  const removeFields = {
    $project: {
      values: 0,
      time: 0
    }
  };

  const out = { $out: outCollection };

  const pipeline = [convertValuesObjectToTicksArray, addTicks, removeFields, out];

  const cursor = collection.aggregate(pipeline, { allowDiskUse: true });

  return cursor.toArray();
}

runMigration(VERSION, DATABASES, PAIRS, TIMEFRAMES).then(results => {
  console.log('Results', results);
}).catch(error => {
  console.error('Failed running migration ${v} because', error);
});
