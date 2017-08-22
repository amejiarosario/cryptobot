const sinon = require('sinon');
const { expect, assert } = require('chai');
const { Observable } = require('rxjs/Rx');
const { MongoClient } = require('mongodb');
const Gdax = require('gdax');

const gdax = require('../providers/gdax');
const amqp = require('../messaging/amqp');
const config = require('../../config');
const { accounts: gdaxFunds, order: gdaxOrder} = require('../../test/responses/gdax');
const mongo = require('./db');
const FakeWebSocket = require('../../test/helpers/fakeWebServer');
const { ticker, Ticker } = require('./ticker');

describe('Ticker', function () {
  const collection = { insertMany: () => { }, updateOne: ()=>{}, find: () => {}, bulkWrite: () => { } };
  const db = { collection: () => { }, close: () => { } };

  const provider = {
    'gdax': ['BTC-USD', 'ETH-USD', 'ETH-BTC']
  };

  const providers = {
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
    if (Gdax.WebsocketClient.restore) Gdax.WebsocketClient.restore();
    if (amqp.serverObservable.restore) amqp.serverObservable.restore();
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
    sinon.stub(gdax, 'setOrder').callsFake((trade, cb) => setTimeout(() => cb(null, { statusCode: 200 }, gdaxOrder), 25));
    sinon.stub(gdax, 'getFunds').callsFake(cb => setTimeout(function() {
      cb(null, null, gdaxFunds);
    }, 25)); // <-- very needed to reproduce the multiple trades bug: lib/ticker/ticker.spec.js:201:28
  });

  describe('Ticker with Class', () => {
    let ticker, fakeWebServer;

    beforeEach(() => {
      if (gdax.tickerObservable.restore) gdax.tickerObservable.restore();
      fakeWebServer = new FakeWebSocket();
      // sinon.stub(amqp, 'serverObservable').returns(Observable.never());
      sinon.stub(amqp, 'serverObservable').returns(Observable.interval(10));
      sinon.stub(Gdax, 'WebsocketClient').returns(fakeWebServer);
      ticker = new Ticker(providers);
    });

    afterEach(() => {
      ticker.unsubscribe();
    });

    describe('# subscribe and unsubscribe', () => {

      it('should start listening for websocket and stop then after', done => {
        let ticks = 0;

        // ticker = new Ticker(providers);

        ticker.subscribe(
          data => {
            if(data.event === 'tick') {
              ticker.unsubscribe();
              ticks++;
            }
          },
          error => done(new Error(error))
        );

        setTimeout(function() {
          // don't expect more ticks
          expect(ticks).to.equal(1);
          done();
        }, 50);
      });

      it('should start listening for orders and unsubscribe', done => {
        let orders = 0, ticks = 0;

        ticker.subscribe(
          data => {
            if(data.event === 'order') {
              orders++;
            }

            if(data.event === 'tick') {
              ticks++;
            }

            if(orders === 2) {
              ticker.unsubscribe();
            }
          },
          error => done(new Error(error))
        );

        setTimeout(function () {
          // don't expect more orders
          expect(orders).to.equal(2);
          expect(ticks).to.equal(2);
          done();
        }, 50);
      });

      it('subscribe and unsubscribe from trailing order events', done => {
        let count = 0;

        if (gdax.setOrder.restore) gdax.setOrder.restore();
        sinon.stub(gdax, 'setOrder').callsFake((trade, cb) => {
          // console.log('cb', cb);
          // simulate slow http request
          setTimeout(function() {
            cb(null, { statusCode: 200 }, gdaxOrder);
          }, 25);
        });

        if (amqp.serverObservable.restore) amqp.serverObservable.restore();
        // sinon.stub(amqp, 'serverObservable').returns(Observable.of(orders));
        sinon.stub(amqp, 'serverObservable').returns(Observable.interval(3).mapTo(orders).take(1));

        if (Gdax.WebsocketClient.restore) Gdax.WebsocketClient.restore();
        fakeWebServer = new FakeWebSocket({ values: [2980, 2981, 2983, 2984, 3000, 3100, 3001, 2999, 2998, 2997, 2996], time: 1 });
        sinon.stub(Gdax, 'WebsocketClient').returns(fakeWebServer);

        ticker = new Ticker(providers); // new ticker with orders

        let lastTrade;

        ticker.subscribe(
          data => {
            // console.log('---data', data.event, JSON.stringify(data));
            if (data.event === 'trade') {
              expect(data.result).to.eql(gdaxOrder);
              lastTrade = data.trade;
              count++;
            }
          },
          error => done(new Error(error))
        );

        setTimeout(function () {
          expect(count).to.equal(1);
          expect(lastTrade).to.eql({ "side": "sell", "size": 0.26550696, "price": 3001, "product_id": "BTC-USD" });
          done();
        }, 120);
      });
    });
  })

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
      // sinon.stub(gdax, 'setOrder').callsFake(executeTradeSpy);

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
              },
              result: gdaxOrder
            });

            expect(gdax.setOrder.called).to.equal(true);
            // console.log(executeTradeSpy.getCall(0).args[0]);
            expect(gdax.setOrder.getCall(0).args[0]).to.eql({ side: 'buy', size: 0.45, price: 2000, product_id: 'BTC-USD'});
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
      // sinon.stub(gdax, 'setOrder');
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
              $set: { status: 'done', position: { side: 'buy', size: 0.19607843, price: 2550, product_id: 'BTC-USD'} },
            });

            done();
          }
        },
        error => done(new Error(error))
      );
    });

    // it didn't reproduce multiple trading issue.
    // I was able to reproduce on "subscribe and unsubscribe from trailing order events"
    xit('should not trade multiple times', done => {
      let prices = [];
      for(let i = 0; i < 100; i++) {
        prices.push(2450.08 + i);
      }
      sinon.stub(amqp, 'serverObservable').returns(Observable.of(orders));
      sinon.stub(gdax, 'tickerObservable').returns(getTicksObservable(prices, 0));

      let count = 0;
      ticker(provider).subscribe(data => {
        if(data.event === 'trade') {
          count++;
          console.log('data', count, data);
        }
        console.log('data1', data);

      }, error => done(new Error(error)));

      setTimeout(() => {
        expect(count).to.equal(1);
        done();
      }, 90);
    });
  });

  describe('Load order', () => {
    it('should load order when it starts', done => {
      sinon.stub(gdax, 'tickerObservable').returns(getTicksObservable([2345.02, 2551.03]));
      sinon.stub(amqp, 'serverObservable').returns(Observable.never());
      // sinon.mock(gdax).expects('setOrder').withArgs({ price: 2551.03, product_id: "BTC-USD", side: "buy", size: 0.19599926 })

      ticker(provider).subscribe(
        data => {
          if (data.event === 'trade') {
            expect(data.trade).eql({
              side: 'buy',
              size: 0.19599926,
              price: 2551.03,
              product_id: 'BTC-USD'
            });
            expect(gdax.setOrder.getCall(0).args[0]).to.eql({ price: 2551.03, product_id: "BTC-USD", side: "buy", size: 0.19599926 });
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