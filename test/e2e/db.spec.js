const { expect } = require('chai');
const sinon = require('sinon');

const mongo = require('../../lib/ticker/db');

// ENV=test mocha --watch 'test/**/*spec.js'

describe('db (real connection to mongo)', function () {
  this.timeout(1000);

  describe('#saveTickAggregation', () => {
    beforeEach(done => {
      // Delete all data from DB (crytest)
      mongo.deleteDb()
        .then(() => done())
        .catch(done);
    });

    it('should save data minutes with ticks', done => {
      mongo.saveTickAggregation(PRODUCT_ID, TICKS).then(() => {
        return mongo.connect();
      }).then(db => {
        const collection = db.collection('gdax.btc-usd-0-minutes-v1');
        return collection.find({}).toArray();
      }).then(docs => {
        // console.log('docs', (docs));
        expect(docs.length).to.equal(2);

        const tick = docs[0].ticks[0];
        expect(tick.time).to.eql('2017-12-31T16:00:15.098000Z');
      }).then(() => {
        return dbi.collection('gdax.btc-usd-1-hours-v1').find({}).toArray();
      }).then(docs => {
        expect(docs.length).to.equal(2);
        expect(docs[0].ticks).to.equal(undefined);
        done();
      })
      .catch(done);
    });

    it('should save data hours withOUT ticks', done => {
      mongo.saveTickAggregation(PRODUCT_ID, TICKS).then(() => {
        return mongo.connect();
      }).then(db => {
        const collection = db.collection('gdax.btc-usd-1-hours-v1');
        return collection.find({}).toArray();
      }).then(docs => {
        expect(docs.length).to.equal(2);
        expect(docs[0].ticks).to.equal(undefined);
        done();
      })
        .catch(done);
    });

  });
});

const PRODUCT_ID = 'gdax.BTC-USD';
const TICKS = [{
  type: 'match',
  trade_id: 17783460,
  maker_order_id: 'ced7415c-072c-4544-a0c7-f0d9d1ddac41',
  taker_order_id: '0995570a-4e96-436b-8d7d-991e8eff3b04',
  side: 'sell',
  size: '0.07531000',
  price: '2583.88000000',
  product_id: 'BTC-USD',
  sequence: 3510553464,
  time: '2017-12-31T16:00:15.098000Z'
}, {
  type: 'match',
  trade_id: 17783461,
  maker_order_id: 'ced7415c-072c-4544-a0c7-f0d9d1ddac41',
  taker_order_id: '0995570a-4e96-436b-8d7d-991e8eff3b04',
  side: 'buy',
  size: '0.08531000',
  price: '2583.88000000',
  product_id: 'BTC-USD',
  sequence: 3510553465,
  time: '2018-01-01T16:00:15.098000Z'
}];