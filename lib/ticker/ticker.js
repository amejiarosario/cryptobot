const {Observable} = require('rxjs/Rx');
const debug = require('debug')('crybot:ticker');

const amqp = require('../messaging/amqp');
const TrailingOrder = require('../analyzer/trailing-order');
const mongo = require('./db');
const package = require('../../package');
// const FakeWebServer = require('../../test/helpers/fakeWebServer');

const event = {
  TRADE: 'trade',
  TICK: 'tick',
  ORDER: 'order'
}

class Ticker {
  constructor(providers, options = {}) {
    this.reset(providers, options);
    this.setupListeners();
  }

  setupListeners() {
    const tickerObservables = this.getTickerObservables(this.providers);
    const orderObservable = this.getOrderObservable();
    this.observables = this.observables.merge(tickerObservables, orderObservable);
  }

  getOrderObservable() {
    // return Observable.of({type: 'order'});
    return amqp.serverObservable().mergeMap(i => Observable.of(Object.assign({}, {
      event: event.ORDER,
      order: i
    })));
  }

  getTickerObservables(providers) {
    const observables = [];

    if(!providers) {
      throw new Error(`Providers can not be null`);
    }

    Object.entries(providers).forEach(([name, productIds]) => {
      const provider = require('../providers/' + name);
      // const fakeWebServer = new FakeWebServer();

      // Ticks
      // const observable = Observable.fromEvent(fakeWebServer, 'message');
      const observable = provider.tickerObservable(productIds);
      // const observable = Observable.of({type: 'match',order_id: '154556c9-c46b-4b3f-939c-5083a286fa41',order_type: 'limit', size: '0.20000000',price: 1,side: 'sell',client_oid: '9db15138-8f44-4a46-8195-d59a8b38de46',product_id: 'BTC-USD',sequence: 3864946233,time: '2017-08-19T13:30:02.657000Z'});

      observables.push(observable.mergeMap(i => Observable.of(Object.assign(i, {
        event: event.TICK,
        provider: name
      }))));
    });

    return Observable.merge.apply(null, observables);
  }

  reset(providers, options) {
    this.providers = providers;
    this.options = options;

    this.tracker = {};
    this.observables = Observable.never();
    this.subscription = null;
  }

  // connect to listeners
  subscribe(onData, onError) {
    this.subscription = this.observables.subscribe(onData, onError);

    process.once('SIGINT', this.unsubscribe);
    process.once('SIGTERM', this.unsubscribe);
  }

  // tear down listeners
  unsubscribe() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.reset();
  }
}


/**
 * Ticker is the main component.
 *
 * 1. Listen to real-time market ticks (WebSockets)
 * 2. Store tick data in database (Mongo)
 * 3. Listen for orders (AMQP)
 * 4. When price reaches it desired point execute order on provider (REST API)
 * 5. Save trades in database (Mongo)
 *
 * @param {*} options
 */
function ticker(providers, options = {}) {
  debug(`Ticker v${package.version}`, providers, options);
  // create tracker and subscribe to:
  //  - ticks
  //  - trades (buy/sell events)
  let {observable, tracker} = subscribeTicksProvider(providers, options);

  // listen for amqp messages (orders)
  const ordersObservable = amqp.serverObservable();

  updateTrailingOrders(tracker, ordersObservable);
  ordersObservable.subscribe(mongo.saveOrders);
  observable = observable.merge(
    ordersObservable.mergeMap(i => Observable.of(Object.assign({}, { event: event.ORDER, order: i })))
  );

  // log events and errors
  observable.subscribe(
    data => {
      if (data.event !== 'tick') { // filtering ticks because it might be too much
        debug(`events: %o`, data);
      }
    },
    error => {
      console.error(new Error(error));
    });

  // return an Observable that concats all other observables (wss (tick), amqp (order), trade)
  return observable;
}

function updateTrailingOrders(tracker, ordersObservable) {
  ordersObservable.subscribe(orders => {
    Object.entries(orders).forEach(([providerProductId, order]) => {
      const to = tracker[providerProductId];
      if (to) {
        to.setOrder(JSON.parse(JSON.stringify(order))); // deep copy
        debug(`Updated trailing order for ${providerProductId}: %o`, to.toObject());
      } else {
        console.error(`Tracker not found for ${key}`);
      }
    });
  });
}

function subscribeTicksProvider(providers, options) {
  let tracker = {};
  let observable = Observable.never();

  // connect to providers and concat observables
  Object.entries(providers).forEach(([name, productIds]) => {
    const provider = require('../providers/' + name);

    // Ticks
    const tickerObservable = provider.tickerObservable(productIds)
      .mergeMap(i => Observable.of(Object.assign(i, { event: event.TICK, provider: name })));
    observable = observable.merge(tickerObservable);

    // Trailing orders
    productIds.forEach(productId => {
      const providerProductId = `${name}.${productId}`;
      // create new trailing order based on provider/productId and trade stream
      const { trailingOrder, tradeStream } = createTrailingOrderAndStream({ name, provider, productId });
      tracker[providerProductId] = trailingOrder;
      observable = observable.merge(tradeStream);

      // Save trades to db / Update orders
      saveTrade(tradeStream);
    });

    // update trailing order with tick prices
    subscribeToTicks(name, tickerObservable, tracker);
    // filter by product_id and bufferTime entry to db
    saveTicksByProductId({ name, productIds, tickerObservable, options});

    // update funds
    provider.getFunds((err, response, funds) => {
      debug(`Updating funds: `, funds);
      if(err) {
        debug(err);
        console.error(new Error(err));
      }
      updateTrackerFunds(tracker, funds);
    });

    // load open orders
    loadOpenOrders(tracker); // TODO: enable
  });
  return {observable, tracker};
}

function loadOpenOrders(tracker) {
  mongo.connect((error, db) => {
    if (error) { return logDbError(error); }

    const collection = db.collection('orders');
    collection.find({ status: 'open' }).toArray(function (err, orders) {
      if (err) { logDbError(err); }

      const ordersMap = orders.reduce((map, order) => {
        // const { provider, ...values } = order; // not ready yet
        const provider = order.provider;
        const values = Object.entries(order).reduce((a, [key, val]) => {
          if (key !== 'provider') {
            a[key] = val;
          }
          return a;
        }, {});

        if (map[provider]) {
          map[provider].push(values);
        } else {
          map[provider] = [values];
        }

        return map;
      }, {});

      Object.entries(ordersMap).forEach(([provider, orderArray]) => {
        const to = tracker[provider];
        if (to) {
          to.setOrder(orderArray);
          debug(`Loading trailing orders for ${provider}: %o`, to.toObject());
        }
      });

      db.close();
    });
  });
}

function saveTrade(tradeStream) {
  tradeStream.subscribe(
    data => {
      mongo.connect((error, db) => {
        if (error) { return logDbError(error); }
        const collection = db.collection('orders');
        collection.updateOne(Object.assign({
          provider: `${data.provider}.${data.trade.product_id}`,
          status: 'open'
        }, data.order), {
          $set: { status: 'done', position: data.trade }
        })
      });
    }
  )
}

function saveTicksByProductId({name, tickerObservable, productIds, options}) {
  const bufferTime = options.bufferTime || 100;

  productIds.forEach((productId, index) => {
    tickerObservable
      .filter(t => t.product_id === productId)
      .bufferTime(bufferTime)
      .filter(buffer => buffer.length > 0) // remove empty buffer
      // .delay(bufferTime * index / productIds.length) // delay some seconds by product id
      .subscribe(
        data => {
          mongo.updateAggregatedData(productId, data.map(d => {
            return {
              _id: d.sequence,
              price: d.price,
              side: d.side,
              size: d.size,
              time: d.time
            };
          }))
        }
      )
  });
}

function createTrailingOrderAndStream({ name, provider, productId }) {
  // create trailing order
  const trailingOrder = new TrailingOrder(productId);
  trailingOrder.setExecuteTradeAction(provider.setOrder); // executeTrade
  trailingOrder.setGetFundsAction(provider.getFunds); // lazy on init or trade

  // subscribe to trailing order events TODO: this can be refactor
  const trades = Observable.fromEvent(trailingOrder, 'trade')
    .mergeMap(i => Observable.of(Object.assign({}, i, { event: event.TRADE, provider: name })));
  const errors = Observable.fromEvent(trailingOrder, 'error').mergeMap(Observable.throw);
  const tradeStream = trades.merge(errors); // TODO: If an Error notification is delivered, then nothing else can be delivered afterwards.
  // const tradeStream = trades.merge(Observable.never());

  return { trailingOrder, tradeStream};
}

function subscribeToTicks(name, observable, tracker) {
  observable.subscribe(
    tick => {
      const key = `${name}.${tick.product_id}`;
      const to = tracker[key];
      if (to) {
        to.setPrice(+tick.price);
      } else {
        console.error(`Tracker not found for ${key}`);
      }
    }
  );
}

function updateTrackerFunds(tracker, funds) {
  Object.entries(tracker).forEach(([key, trailingOrder]) => {
    trailingOrder.setFunds(funds);
  });
}

function logDbError(error) {
  console.error('ERROR: mongo.connect', new Error(error));
}


module.exports = {
  ticker,
  Ticker
};