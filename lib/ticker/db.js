const { MongoClient } = require('mongodb');
const co = require('co');
const moment = require('moment');
const debug = require('debug')('crybot:db');

const CONFIG = require('../../config');
const FORMAT = 'YYYY/MMM(W)DD+HH:mm_ss.SSS';
const TIMES = {
  minutes: '_',
  hours: ':',
  days: '+',
  weeks: ')',
  months: '('
};

debug('Databse: ', CONFIG.db.uri);

/**
 *
 * @param {Array} data multiple prices
 * @param {String} productId product id such as BTC-USD or ETH-USD
 */
function updateAggregatedData(productId, data) {
  // console.log('db::updateAggregatedData');
  // return new Promise(() => { });

  return co(function* updateAggregatedDataGen() {
    const db = yield MongoClient.connect(CONFIG.db.uri);

    // console.log('updateAggregatedData: ', productId, (data && data.length), CONFIG.db.uri)

    for (const time of Object.keys(TIMES)) {
      const bulkWrite = prepareBulkWrite(data, time);
      const collection = db.collection(`${productId.toLowerCase()}-${time}`);
      // console.log('---bulkWrite---', bulkWrite);
      const r = yield collection.bulkWrite(bulkWrite, { ordered: true, w: 1 });
      const { nUpserted, modifiedCount } = r;
      debug(`${productId} bulk operation`, { nUpserted, modifiedCount }, '[verbose]'); // too many
    }

    db.close();
  }).catch(error => console.error(new Error(error)));
}

function prepareBulkWrite(data, time) {
  const bulkWrite = [];
  let seq = 100;

  const splitter = TIMES[time];

  for (const doc of data) {
    const price = parseFloat(doc.price);
    const volume = parseFloat(doc.size);
    const bought = doc.side === 'buy' ? volume : 0;
    const sold = doc.side === 'sell' ? volume : 0;
    const timestamp = moment.utc(doc.time);
    const [aggregatorFormat, keyFormat] = FORMAT.split(splitter);
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

    bulkWrite.push({ updateOne: { filter, update, upsert: true } });
  }
  return bulkWrite;
}

function saveTrade(data) {
  // console.log('db::saveTrade');
  // return new Promise(() => { });

  return co(function*(){
    const db = yield MongoClient.connect(CONFIG.db.uri);
    const collection = db.collection('orders');

    const results = yield collection.updateOne(Object.assign({
      provider: `${data.provider}.${data.trade.product_id}`,
      status: 'open'
    }, data.order), {
      $set: {
        status: 'done',
        position: data.trade,
        result: data.result
      }
    });

    const { nUpserted, modifiedCount } = results;
    debug(`Orders operation saved`, { nUpserted, modifiedCount });

    db.close();
  }).catch(error => console.error(new Error(error)));
}

function saveOrders(data) {
  // console.log('db::saveOrders');
  // return new Promise(() => { });
  // console.log('---- db.saveOrders', data);

  return co(function* () {
    const db = yield MongoClient.connect(CONFIG.db.uri);

    const collection = db.collection('orders');
    const status = 'open';

    const orders = Object.entries(data).reduce((orders, [provider, trades]) => {
      trades.forEach(trade => {
        const t = Object.assign({}, { provider, status, trailing: {}, trade: {} }, trade);
        orders.push({
          updateOne: {
            filter: { provider, status, side: t.side, target: t.target },
            update: { $set: t },
            upsert: true
          }
        });
      });

      return orders;
    }, []);

    // console.log('collection.bulkWrite', JSON.stringify(orders));

    const r = yield collection.bulkWrite(orders);
    const { nUpserted, modifiedCount } = r;
    debug(`Orders operation saved`, { nUpserted, modifiedCount }); // too many

    db.close();
    return r;
  }).catch(error => console.error(error.stack));
}

function loadOrders(query = {status: 'open'}) {
  // console.log('db::loadOrders');
  // return new Promise(() => {});

  return co(function* () {
    const db = yield MongoClient.connect(CONFIG.db.uri);
    const collection = db.collection('orders');
    const docs = yield collection.find(query).toArray();
    const results = {};

    docs.reduce((r, d) => {
      const newOrder = {
        side: d.side,
        target: d.target,
        // id: d._id
      };

      if(d.trailing) newOrder.trailing = d.trailing;
      if (d.trade) newOrder.trade = d.trade;
      if (!r[d.provider]) {
        r[d.provider] = [];
      }

      r[d.provider].push(newOrder);
      return r;
    }, results);

    db.close();
    return results;
  }).catch(error => console.error(error.stack));
}

module.exports = {
  connect: (cb) => { // for e2e's
    debug(`connecting to ${CONFIG.db.uri}`);
    return MongoClient.connect(CONFIG.db.uri, cb);
  },
  // MongoClient,
  updateAggregatedData,
  saveOrders,
  loadOrders,
  saveTrade
};