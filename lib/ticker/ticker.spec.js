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
    if (mongo.saveTrade.restore) mongo.saveTrade.restore();
    if (mongo.saveOrders.restore) mongo.saveOrders.restore();
    if (mongo.loadOrders.restore) mongo.loadOrders.restore();
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
    sinon.stub(mongo, 'saveTrade');
    sinon.stub(mongo, 'saveOrders');
    sinon.stub(mongo, 'loadOrders').returns(new Promise(() => {}));
    sinon.stub(MongoClient, 'connect').resolves(db);
    sinon.stub(mongo, 'updateAggregatedData');
    sinon.stub(gdax, 'setOrder').callsFake((trade, cb) => setTimeout(() => cb(null, { statusCode: 200 }, gdaxOrder), 25));
    sinon.stub(gdax, 'getFunds').callsFake(cb => setTimeout(function() {
      cb(null, null, gdaxFunds);
    }, 10)); // <-- very needed to reproduce the multiple trades bug: lib/ticker/ticker.spec.js:201:28
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
          setTimeout(function() {
            cb(null, { statusCode: 200 }, gdaxOrder);
          }, 25);
        });

        if (amqp.serverObservable.restore) amqp.serverObservable.restore();
        // sinon.stub(amqp, 'serverObservable').returns(Observable.of(orders));
        sinon.stub(amqp, 'serverObservable').returns(Observable.interval(3).mapTo(orders).take(1));

        if (Gdax.WebsocketClient.restore) Gdax.WebsocketClient.restore();
        fakeWebServer = new FakeWebSocket({ values: [2980, 2981, 2983, 2984, 3000, 3100, 3001, 2999, 2998, 2997, 2996], time: 1 });
        // fakeWebServer.start();
        sinon.stub(Gdax, 'WebsocketClient').returns(fakeWebServer);

        ticker = new Ticker(providers); // new ticker with orders

        let lastTrade;

        ticker.subscribe(
          data => {
            // if(data.event !== 'tick') console.log('---data', data.event, JSON.stringify(data));
            if (data.event === 'trade') {
              expect(data.result).to.eql(gdaxOrder);
              lastTrade = data.trade;
              count++;
            }
          },
          error => done(new Error(error))
        );

        setTimeout(function () {
          const args = mongo.saveTrade.getCall(0).args[0];
          const trade = { "side": "sell", "size": 0.26550696, "price": 3001, "product_id": "BTC-USD" };

          expect(count).to.equal(1);
          expect(lastTrade).to.eql(trade);

          expect(args.result).to.eql(gdaxOrder);
          expect(args.trade).to.eql(trade);
          expect(args.provider).to.eql('gdax');
          expect(args.order).to.eql(orders['gdax.BTC-USD'][1]);

          const [pid, mongoSaved] = mongo.updateAggregatedData.getCall(0).args;
          expect(pid).to.equal('gdax.BTC-USD');
          expect(mongoSaved.length).to.greaterThan(1);
          expect(mongoSaved.filter(t => t.price === 3000)[0]).to.eql({
            "_id": 3436653933,
            "price": 3000,
            "side": "buy",
            "size": 0.02,
            "time": "2017-06-27T21:27:16.802000Z"
          });

          done();
        }, 120);
      });

      it('should clean trailing orders on unsubscribe', done => {
        let count = 0;

        if (gdax.setOrder.restore) gdax.setOrder.restore();
        sinon.stub(gdax, 'setOrder').callsFake((trade, cb) => {
          setTimeout(function () {
            cb(null, { statusCode: 200 }, gdaxOrder);
          }, 1);
        });

        if (amqp.serverObservable.restore) amqp.serverObservable.restore();
        sinon.stub(amqp, 'serverObservable').returns(Observable.of(orders));
        // sinon.stub(amqp, 'serverObservable').returns(Observable.interval(3).mapTo(orders).take(1));

        if (Gdax.WebsocketClient.restore) Gdax.WebsocketClient.restore();
        fakeWebServer = new FakeWebSocket({ values: [2980, 2981, 2983, 2984, 3000, 3100, 3001, 2999, 2998, 2997, 2996], time: 1 });
        sinon.stub(Gdax, 'WebsocketClient').returns(fakeWebServer);

        ticker = new Ticker(providers); // new ticker with orders

        let lastTrade;

        ticker.subscribe(data => {
          if (data.event === 'trade') {
            // console.log('---data**1', data.event, JSON.stringify(data));
            expect(Object.keys(ticker.orders)).to.eql(['gdax.BTC-USD']);
            ticker.unsubscribe();
            expect(Object.keys(ticker.orders)).to.eql([]);
            done();
          }
        });
      });

    });
  });

  describe('# Ticks', () => {
    it('should call the ticker function on the provider', done => {
      sinon.stub(gdax, 'tickerObservable').returns(getTicksObservable([10], 15, { product_id: 'ETH-USD' }));
      sinon.stub(amqp, 'serverObservable').returns(Observable.never());

      const providers = {
        'gdax': ['ETH-USD']
      };

      const ticker = new Ticker(providers);
      ticker.subscribe(
        data => {
          expect(data.event).to.equal('tick');
          expect(data.tick.price).to.equal(10);
          expect(data.tick.product_id).to.equal('ETH-USD');
          done();
          ticker.unsubscribe();
        },
        error => done(new Error(error))
      );
    });
  });

  describe('# Trade', () =>{
    it('should make a trade with all corresponding fields', done =>{
      const orders = { 'gdax.BTC-USD': [{ "side": "buy", "target": 2046, "trailing": { "amount": 50, "percentage": 0.5 }, trade: { "percentage": 0.5, "amount": 900 } }] };
      const providers = { 'gdax': ['BTC-USD', 'ETH-BTC'] };
      let orderCalled = false;

      sinon.stub(amqp, 'serverObservable').returns(Observable.of(orders));
      sinon.stub(gdax, 'tickerObservable').returns(getTicksObservable([1500, 1510, 2000], 10));

      const ticker = new Ticker(providers);

      ticker.subscribe(
        data => {
          if (data.event === 'order') {
            expect(data.order).to.eql(orders);
            orderCalled = true;
          }
          if (data.event === 'trade') {
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

            expect(orderCalled).to.equal(true);
            ticker.unsubscribe();
            done();
          }
        },
        error => done(new Error(error))
      );
    });
  });

  describe('# Orders', () => {
    it('should save orders to db', done => {
      sinon.stub(gdax, 'tickerObservable').returns(Observable.never());
      sinon.stub(amqp, 'serverObservable').returns(Observable.of(orders));

      const ticker = new Ticker(provider);
      ticker.subscribe(
        data => {
          setTimeout(function() {
            expect(mongo.saveOrders.called).to.equal(true);
            expect(mongo.saveOrders.getCall(0).args).to.eql([orders]);
            ticker.unsubscribe();
            done();
          }, 10);
        },
        error => done(new Error(error))
      );
    });

    it('should load order on start', done => {
      sinon.stub(gdax, 'tickerObservable').returns(Observable.never());
      sinon.stub(amqp, 'serverObservable').returns(Observable.never());

      if (mongo.loadOrders.restore) mongo.loadOrders.restore();
      sinon.stub(mongo, 'loadOrders').resolves(orders);

      const ticker = new Ticker(provider);
      ticker.subscribe(
        data => {
          setTimeout(function () {
            expect(mongo.loadOrders.called).to.equal(true);
            expect(data).to.eql({
              "event": "order",
              "order": {
                "gdax.BTC-USD": [
                  {
                    "side": "buy",
                    "target": 2500,
                    "trade": {
                      "amount": 500,
                      "percentage": 0.5
                    },
                    "trailing": {
                      "amount": 50
                    }
                  },
                  {
                    "side": "sell",
                    "target": 3000
                  }
                ]
              },
              "saved": true
            });

            // should not save order if is already saved
            expect(mongo.saveOrders.called).to.equal(false);

            ticker.unsubscribe();
            done();
          }, 10);
        },
        error => done(new Error(error))
      );
    });
  })
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