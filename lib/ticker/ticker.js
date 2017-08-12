const {Observable} = require('rxjs/Rx');
const debug = require('debug')('crybot:ticker');

const amqp = require('../messaging/amqp');
const TrailingOrder = require('../analyzer/trailing-order');
const mongo = require('./db');
const package = require('../../package');

const event = {
  TRADE: 'trade',
  TICK: 'tick',
  ORDER: 'order'
}

function ticker(providers, options = {}) {
  debug(`Ticker v${package.version}`, providers, options);
  // create tracker and subscribe to:
  //  - ticks
  //  - trades (buy/sell events)
  let {observable, tracker} = subscribeTicksProvider(providers, options);

  // listen for amqp messages (orders)
  const ordersObservable = amqp.serverObservable();

  updateTrailingOrders(tracker, ordersObservable);
  saveOrders(ordersObservable);
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

function ordersBroker(msg) {

}

function saveOrders(ordersObservable) {
  ordersObservable.subscribe(
    data => {
      mongo.connect((error, db) => {
        if (error) { return logDbError(error); }

        const collection = db.collection('orders');
        const orders = [];
        Object.entries(data).forEach(([providerProduct, trade]) => {
          trade.forEach(trade => {
            orders.push(Object.assign({
              provider: providerProduct,
              status: 'open'
            }, trade));
          });
        });
        debug(`Saving order: %o`, orders);
        collection.insertMany(orders);
      })
    }
  )
}

function updateTrailingOrders(tracker, ordersObservable) {
  ordersObservable.subscribe(orders => {
    Object.entries(orders).forEach(([providerProductId, order]) => {
      const to = tracker[providerProductId];
      if (to) {
        to.setOrder(order);
        debug(`Updated trailing order for ${providerProductId}: %o`, to);
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
    provider.getFunds(funds => {
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
        }
        debug(`Loading trailing orders for ${provider}: %o`, to);
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
          $set: { status: 'done', trade: data.trade }
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
  const tradeStream = trades.merge(errors);

  return {trailingOrder, tradeStream};
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
  const available = (funds || []).reduce((a, f) => {
    a[f.currency] = f.available;
    return a;
  }, {});

  Object.entries(tracker).forEach(([key, trailingOrder]) => {
    trailingOrder.setFunds(available);
  });
}

function logDbError(error) {
  console.error('ERROR: mongo.connect', new Error(error));
}


module.exports = ticker;