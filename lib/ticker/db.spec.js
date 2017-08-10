const sinon = require('sinon');
const { expect, assert } = require('chai');
const { MongoClient } = require('mongodb');

const mongo = require('./db');
const db = { collection: () => { }, close: () => { } };
const collection = { bulkWrite: () => { }};

describe('db', function () {
  describe('# updateAggregatedData', () => {
    beforeEach(done => {
      let times = 0;
      sinon.stub(collection, 'bulkWrite').callsFake(() => {
        times++;
        if(times > 4) done();
        return Promise.resolve({ nUpserted: 1, modifiedCount: 4 });
      });
      sinon.stub(db, 'collection').returns(collection);
      sinon.stub(MongoClient, 'connect').resolves(db);

      mongo.updateAggregatedData('BTC-USD', data);
    });

    afterEach(() => {
      if (MongoClient.connect.restore) MongoClient.connect.restore();
      if (collection.bulkWrite.restore) collection.bulkWrite.restore();
      if (db.collection.restore) db.collection.restore();
    });

    it('should call bulk updates for minutes time frame', () => {
      expect(collection.bulkWrite.getCall(0).args[0]).to.eql(bulkUpdateData);
    });

    xit('should call bulk updates for hours time frame', () => {
      expect(collection.bulkWrite.getCall(1).args[0]).to.eql(bulkUpdateData);
    });

    xit('should call bulk updates for months time frame', () => {
      expect(collection.bulkWrite.getCall(4).args[0]).to.eql(bulkUpdateData);
    });
  });
});

const data = [
  {
    "_id": "5988ea7f5968f700045049f8",
    "time": "2017-12-31T23:59:59.998Z",
    "price": 3370.68,
    "size": 0.10608787,
    "side": "sell"
  },
  {
    "_id": "5988ea7f5968f700045049f9",
    "time": "2017-12-31T23:59:59.999Z",
    "price": 3370.69,
    "size": 0.10608787,
    "side": "sell"
  },
  {
    "_id": "5988ea7f5968f700045049f1",
    "time": "2018-01-01T00:00:00.000Z",
    "price": 3370.70,
    "size": 0.10608787,
    "side": "buy"
  },
];

const bulkUpdateData = [{
  updateOne: {
    filter: { time: "2017/Dec(52)31+23:59" },
    "upsert": true,
    update: {
      $inc: { bought: 0, count: 1, sold: 0.10608787, volume: 0.10608787 },
      $max: { high: 3370.68 },
      $min: { low: 3370.68 },
      $set: {
        close: 3370.68,
        'values.59998101': {
          _id: "5988ea7f5968f700045049f8",
          price: 3370.68,
          side: "sell",
          size: 0.10608787,
          time: "2017-12-31T23:59:59.998Z"
        }
      },
      $setOnInsert: { open: 3370.68 }
    }
  }
},
{
  updateOne: {
    filter: { time: "2017/Dec(52)31+23:59" },
    "upsert": true,
    update: {
      $inc: { bought: 0, count: 1, sold: 0.10608787, volume: 0.10608787 },
      $max: { high: 3370.69 },
      $min: { low: 3370.69 },
      $set: {
        close: 3370.69,
        'values.59999102': {
          _id: "5988ea7f5968f700045049f9",
          price: 3370.69,
          side: "sell",
          size: 0.10608787,
          time: "2017-12-31T23:59:59.999Z"
        }
      },
      $setOnInsert: { open: 3370.69 }
    }
  }
}, {
  updateOne: {
    filter: { time: "2018/Jan(1)01+00:00" },
    "upsert": true,
    update: {
      $inc: { bought: 0.10608787, count: 1, sold: 0, volume: 0.10608787 },
      $max: { high: 3370.7 },
      $min: { low: 3370.7 },
      $set: {
        close: 3370.7,
        'values.103': {
          _id: "5988ea7f5968f700045049f1",
          price: 3370.7,
          side: "buy",
          size: 0.10608787,
          time: "2018-01-01T00:00:00.000Z"
        }
      },
      $setOnInsert: { open: 3370.7 }
    }
  }
}];

function s(object) {
  return JSON.stringify(object, null, 2);
}