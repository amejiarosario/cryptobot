const sinon = require('sinon');
const { expect, assert } = require('chai');
const { Observable } = require('rxjs/Rx');
const { MongoClient } = require('mongodb');

const ticker = require('./ticker');
const gdax = require('../providers/gdax');
const amqp = require('../messaging/amqp');
const config = require('../../config');
const { accounts: gdaxFunds} = require('../../test/responses/gdax');
const mongo = require('./db');

describe('Ticker', function () {
  const collection = { insertMany: () => { }, updateOne: ()=>{}, find: () => {}, bulkWrite: () => { } };
  const db = { collection: () => { }, close: () => { } };

  const provider = {
    'gdax': ['BTC-USD', 'ETH-USD', 'ETH-BTC']
  };

  const orders = {
    'gdax.BTC-USD': [
      { "side": "buy", "target": 2500, "trailing": { "amount": 50 }, trade: { "percentage": 0.5, "amount": 500 } },
      { "side": "sell", "target": 3000 }
    ]
  };

  const expectedOrders = [{
    provider: "gdax.BTC-USD",
    side: "buy",
    status: "open",
    target: 2500,
    trade: { amount: 500, percentage: 0.5 },
    trailing: { amount: 50 }
  }, { provider: "gdax.BTC-USD", side: "sell", status: "open", target: 3000 }];

  const bulkOrders = [
    {
      "updateOne": {
        "filter": { "provider": "gdax.BTC-USD", "status": "open", "side": "buy", "target": 2500 },
        "update": { "$set": { "side": "buy", "target": 2500, "trailing": { "amount": 50 }, "trade": { "percentage": 0.5, "amount": 500 }, "provider": "gdax.BTC-USD", "status": "open" } },
        "upsert": true
      }
    },
    {
      "updateOne": {
        "filter": { "provider": "gdax.BTC-USD", "status": "open", "side": "sell", "target": 3000 },
        "update": { "$set": { "side": "sell", "target": 3000, "provider": "gdax.BTC-USD", "status": "open", trailing: {}, trade: {} } },
        "upsert": true
      }
    }
  ];

  const error = null;//sinon.stub();

  this.timeout(200);

  afterEach(() => {
    if (gdax.tickerObservable.restore) gdax.tickerObservable.restore();
    if (gdax.getFunds.restore) gdax.getFunds.restore();
    if (gdax.executeTrade.restore) gdax.executeTrade.restore();
    if (gdax.ticker.restore) gdax.ticker.restore();
    if (gdax.setOrder.restore) gdax.setOrder.restore();
    if (amqp.serverObservable.restore) amqp.serverObservable.restore();
    if (mongo.connect.restore) mongo.connect.restore();
    if (MongoClient.connect.restore) MongoClient.connect.restore();
    if (mongo.updateAggregatedData.restore) mongo.updateAggregatedData.restore();
    if (collection.insertMany.restore) collection.insertMany.restore();
    if (collection.bulkWrite.restore) collection.bulkWrite.restore();
    if (collection.updateOne.restore) collection.updateOne.restore();
    if (collection.find.restore) collection.find.restore();
    if (collection.restore) collection.restore();
    if (db.collection.restore) db.collection.restore();
  });

  beforeEach(() => {
    sinon.stub(collection, 'bulkWrite').resolves({});
    sinon.stub(collection, 'insertMany');
    sinon.stub(collection, 'updateOne');
    sinon.stub(collection, 'find').returns({ toArray: (cb) => cb(error, expectedOrders) });
    sinon.stub(db, 'collection').returns(collection);
    sinon.stub(mongo, 'connect').callsFake(cb => cb(error, db));
    sinon.stub(MongoClient, 'connect').resolves(db);
    sinon.stub(mongo, 'updateAggregatedData');
    sinon.stub(gdax, 'getFunds').callsFake(cb => cb(null, null, gdaxFunds));
  });

  describe('Provider market ticks', () => {
    it('should call the ticker function on the provider', done => {
      sinon.stub(gdax, 'tickerObservable').returns(getTicksObservable([10], 15, { product_id: 'ETH-USD' }));
      sinon.stub(amqp, 'serverObservable').returns(Observable.never());

      const providers = {
        'gdax': ['ETH-USD']
      };

      ticker(providers).subscribe(
        data => {
          expect(data.event).to.equal('tick');
          expect(data.price).to.equal(10);
          expect(data.product_id).to.equal('ETH-USD');
          done();
        },
        error => done(new Error(error))
      );
    });
  });

  describe('Execute orders on Provider', () => {
    it('should set a trailing order when gets order via amqp and execute order', (done) => {
      const orders = { 'gdax.BTC-USD': [{ "side": "buy", "target": 2046, "trailing": { "amount": 50, "percentage": 0.5 }, trade: { "percentage": 0.5, "amount": 900 } }] };
      const providers = { 'gdax': ['BTC-USD', 'ETH-BTC']};
      const executeTradeSpy = sinon.spy();
      let orderCalled = false;

      sinon.stub(amqp, 'serverObservable').returns(Observable.of(orders));
      sinon.stub(gdax, 'tickerObservable').returns(getTicksObservable([1500, 1510, 2000], 10));
      sinon.stub(gdax, 'setOrder').callsFake(executeTradeSpy);

      const observable = ticker(providers);

      observable.subscribe(
        data => {
          if(data.event === 'order') {
            expect(data.order).to.eql(orders);
            orderCalled = true;
          }
          if(data.event === 'trade') {
            expect(data).to.eql({
              event: 'trade',
              provider: 'gdax',
              "order": {
                "side": "buy",
                "target": 2046,
                "trade": {
                  "amount": 900,
                  "percentage": 0.5
                },
                "trailing": {
                  "amount": 50,
                  "percentage": 0.5
                }
              },
              "trade": {
                "price": 2000,
                "product_id": "BTC-USD",
                "side": "buy",
                "size": 0.45
              }
            });

            expect(executeTradeSpy.called).to.equal(true);
            // console.log(executeTradeSpy.getCall(0).args[0]);
            expect(executeTradeSpy.getCall(0).args[0]).to.eql({ side: 'buy', size: 0.45, price: 2000, product_id: 'BTC-USD'});
            expect(orderCalled).to.equal(true);
            done();
          }
        },
        error => done(new Error(error))
      );
    });
  });

  describe('Save data by minute/pair/provider', () => {
    beforeEach(() => {
      sinon.stub(gdax, 'setOrder');
    });

    it('should save ticks by products', done => {
      sinon.stub(amqp, 'serverObservable').returns(Observable.never());
      sinon.stub(gdax, 'tickerObservable').returns(getTicksObservable([2345.02]));

      ticker(provider).subscribe(
        data => {
          sinon.assert.calledWithExactly(mongo.updateAggregatedData, 'BTC-USD', [{
            _id: 1234,
            price: 2345.02,
            side: "buy",
            size: 0.01,
            time: '2017-08-04T20:12:16.277Z'
          }]);
          done();
        },
        error => done(new Error(error))
      );
    });

    it('should save order events', done => {
      sinon.stub(gdax, 'tickerObservable').returns(Observable.never());
      sinon.stub(amqp, 'serverObservable').returns(Observable.of(orders));

      ticker(provider).delay(5).subscribe(
        data => {
          sinon.assert.calledWithExactly(db.collection, 'orders');
          sinon.assert.calledWithExactly(collection.bulkWrite, bulkOrders);
          done();
        },
        error => done(new Error(error))
      );
    });

    it('should save trades and mark order as done', done => {
      sinon.stub(amqp, 'serverObservable').returns(Observable.of(orders));
      sinon.stub(gdax, 'tickerObservable').returns(getTicksObservable([2345.02, 2550]));

      let count = 0;
      ticker(provider).subscribe(
        data => {
          count++;
          // console.log('data', count, data);
          if(count > 3) {
            sinon.assert.called(collection.bulkWrite);

            sinon.assert.calledWithExactly(collection.bulkWrite, bulkOrders);
            sinon.assert.calledWithExactly(mongo.updateAggregatedData, 'BTC-USD', [
              { _id: 1234, price: 2345.02, side: "buy", size: 0.01, time: "2017-08-04T20:12:16.277Z" },
              { _id: 1234, price: 2550, side: "buy", size: 0.01, time: "2017-08-04T20:12:16.277Z" }]);

            sinon.assert.calledWithExactly(collection.updateOne, expectedOrders[0], {
              $set: { status: 'done', trade: { side: 'buy', size: 0.19607843, price: 2550, product_id: 'BTC-USD'} },
            });

            done();
          }
        },
        error => done(new Error(error))
      );

    });
  });

  describe('Load order', () => {
    it('should load order when it starts', done => {
      sinon.stub(gdax, 'tickerObservable').returns(getTicksObservable([2345.02, 2551.03]));
      sinon.stub(amqp, 'serverObservable').returns(Observable.never());
      sinon.mock(gdax).expects('setOrder').withArgs({ price: 2551.03, product_id: "BTC-USD", side: "buy", size: 0.19599926 })

      ticker(provider).subscribe(
        data => {
          if (data.event === 'trade') {
            expect(data.trade).eql({
              side: 'buy',
              size: 0.19599926,
              price: 2551.03,
              product_id: 'BTC-USD'
            });
            done();
          }
        },
        error => done(new Error(error))
      );
    });
  });

  describe('Working with multiple pairs BTC/USD, ETH/USD, LTC/USD', () => { });
  describe('Working with multiple provides GDAX, Poloniex', () => { });
});

function getTicksObservable(values, delay = 10, object = { product_id: 'BTC-USD' }) {
  return Observable.of.apply(null, values)
    .concatMap(x => Observable.of(Object.assign({
      "sequence": 1234,
      "time": "2017-08-04T20:12:16.277Z", //(new Date()).toISOString(),
      "price": x,
      "size": 0.01,
      "side": "buy"
    }, object) )
      .delay(delay))
}