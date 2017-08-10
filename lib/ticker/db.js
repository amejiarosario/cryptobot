const { MongoClient } = require('mongodb');
const co = require('co');
const moment = require('moment');
const debug = require('debug')('db');

const config = require('../../config');
const format = 'YYYY/MMM(W)DD+HH:mm_ss.SSS';
const times = {
  minutes: '_',
  hours: ':',
  days: '+',
  weeks: ')',
  months: '('
};

/**
 *
 * @param {Array} data multiple prices
 * @param {String} productId product id such as BTC-USD or ETH-USD
 */
function updateAggregatedData(data, productId) {
  co(function* () {
    const db = yield MongoClient.connect(config.db.uri);

    for (const time of Object.keys(times)) {
      const bulkWrite = prepareBulkWrite(data, time);
      const collection = db.collection(`${productId.toLowerCase()}-${time}`);
      yield collection.bulkWrite(bulkWrite);
    }
  }).catch(error => console.error(new Error(error)));
}

function prepareBulkWrite(data, time) {
  const bulkWrite = [];
  let seq = 100;

  const splitter = times[time];

  for (const doc of data) {
    const price = parseFloat(doc.price);
    const volume = parseFloat(doc.size);
    const bought = doc.side === 'buy' ? volume : 0;
    const sold = doc.side === 'sell' ? volume : 0;
    const timestamp = moment.utc(doc.time);
    const [aggregatorFormat, keyFormat] = format.split(splitter);
    const aggregator = timestamp.format(aggregatorFormat);

    const set = {};
    const setOnInsert = { open: price };
    if (time === 'minutes') {
      seq = seq > 900 ? 100 : seq + 1;
      const microseconds = Math.round((timestamp.format('ss.SSS') + seq) * 1e6);
      set[`values.${microseconds}`] = doc; // don't save for agg higher than minutes
    } else {
      set['values.close'] = doc;
      setOnInsert['values.open'] = doc;
    }
    set.close = price;

    const filter = {
      time: aggregator
    };

    const options = { upsert: true };

    const update = {
      $max: { high: price },
      $min: { low: price },
      $setOnInsert: setOnInsert,
      $inc: {
        count: 1,
        volume: volume,
        bought: bought,
        sold: sold
      },
      $set: set
    };

    bulkWrite.push({ updateOne: { filter, update, options } });
  }
  return bulkWrite;
}

module.exports = {
  connect: (cb) => {
    debug(`connecting to ${config.db.uri}`);
    return MongoClient.connect(config.db.uri, cb);
  },
  MongoClient,
  updateAggregatedData
};