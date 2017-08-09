/*
Ticks aggregation (min, hr, day, wk, month)
  - open
  - close
  - high
  - low
  - sold (volume)
  - bought (volume)
  - volume (sold+bought)


min
  - miliseconds values 1000
hr
  - minutes values 60
day
  - hours values 24
wk
  - days values 7
mo
  - days values 28-31
*/

const { MongoClient } = require('mongodb');
const co = require('co');
const moment = require('moment');

const uri = 'mongodb://localhost:27017/localbot4';

// -------------------
// iterator
//
// http://mongodb.github.io/node-mongodb-native/2.2/api/Cursor.html
// -------------------

// co(function*(){
//   const db = yield MongoClient.connect(uri);
//   const collection = db.collection('btc-usd-ticker');

//   var cursor = collection.find({});
//   var i = 0;

//   while (yield cursor.hasNext()) {
//     console.log(yield cursor.next());
//     if(i++ > 10) break;
//   }

//   db.close();
// });

// -------------------
// iterator //
// -------------------

// -------------------
// Aggregator
// -------------------

co(function* () {

  // db.getCollection('btc-usd-ticker').createIndex({time: 1})
  // db.getCollection('btc-usd-ticker').find({}).sort({time: -1})

  const db = yield MongoClient.connect(uri);
  const collection = db.collection('btc-usd-ticker');
  const agg = db.collection('btc-usd-ticker.minutes');

  yield agg.remove({});

  var cursor = collection.find({}).sort({ time: 1 });
  // var hasNext = yield cursor.hasNext();

  let seq = 100;

  while (yield cursor.hasNext()) {
    var doc = yield cursor.next();
    if(!doc) continue;

    seq = seq > 900 ? 100 : seq + 1;

    const bought = doc.side === 'buy' ? +doc.size : 0;
    const sold = doc.side === 'sell' ? +doc.size : 0;
    const timestamp = moment.utc(doc.time);
    const date = timestamp.format('YYYY MMM (W) DD HH:mm');
    const microseconds = Math.round((timestamp.format('ss.SSS') + seq) * 1e6);
    const price = +doc.price;

    const values = {
      close: price
    };
    values[`values.${microseconds}`] = doc;

    const filter = { timeAggregate: date };
    const options = { upsert: true };

    const update = {
      $max: { high: price},
      $min: { low: price },
      $setOnInsert: { open: price },
      $inc: {
        count: 1,
        volume: +doc.size,
        bought: bought,
        sold: sold
      },
      $set: values
    };

    // console.log(`${microseconds} --- ${doc.time}`, value);

    yield agg.updateOne(filter, update, options);
  }

  db.close();
});

// 3798688032
// 8032
function last(thing, index = 3) {
  const string = thing.toString();
  return string.substring(string.length - index);
}

// -------------------
// Aggregator //
// -------------------