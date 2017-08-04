const {Observable} = require('rxjs/Rx');

const amqp = require('../messaging/amqp');
const TrailingOrder = require('../analyzer/trailing-order');
const mongo = require('./db');

const event = {
  TRADE: 'trade',
  TICK: 'tick',
  ORDER: 'order'
}

function ticker(providers) {
  let {observable, tracker} = subscribeTicksProvider(providers);

  // listen for amqp messages
  const ordersObservable = amqp.serverObservable();
  updateTrailingOrders(tracker, ordersObservable);
  // TODO: save orders to db
  observable = observable.merge(
    ordersObservable.mergeMap(i => Observable.of(Object.assign({}, { event: event.ORDER, order: i })))
  );

  // return an Observable that concats all other observables (wss (tick), amqp (order), trade)
  return observable;
}

function updateTrailingOrders(tracker, ordersObservable) {
  ordersObservable.subscribe(orders => {
    Object.entries(orders).forEach(([providerProductId, order]) => {
      const to = tracker[providerProductId];
      if (to) {
        to.setOrder(order);
      } else {
        console.error(`Tracker not found for ${key}`);
      }
    });
  });
}

function subscribeTicksProvider(providers) {
  let tracker = {};
  let observable = Observable.never();

  // connect to providers and concat observables
  Object.entries(providers).forEach(([name, productIds]) => {
    const provider = require('../providers/' + name);

    // Trailing orders
    productIds.forEach(productId => {
      // create new trailing order based on provider/productId and trade stream
      const { trailingOrder, tradeStream } = createTrailingOrderAndStream({ name, provider, productId });
      tracker[`${name}.${productId}`] = trailingOrder;
      observable = observable.merge(tradeStream);
      // TODO: subscribe to save orders to db
    });

    // Ticks
    const tickerObservable = provider.tickerObservable(productIds)
      .mergeMap(i => Observable.of(Object.assign(i, { event: event.TICK, provider: name })));
    observable = observable.merge(tickerObservable);

    // update trailing order with tick prices
    subscribeToTicks(name, tickerObservable, tracker);
    // TODO: filter by product_id and bufferTime entry to db

    // update funds
    provider.getFunds(funds => {
      updateTrackerFunds(tracker, funds);
    });
  });
  return {observable, tracker};
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

function saveEvents(observable, bufferTime = 30e3) {
  // observable.filter(d => d.event === event.TICK).bufferTime(bufferTime).subscribe(saveTicks);
  // observable.filter(d => d.event === event.ORDER).subscribe(saveOrder);
  // observable.filter(d => d.event === event.TRADE).subscribe(saveTrade);

  observable.subscribe(
    data => {
      if(data.event === 'order') {
        // mongo.connect((error, db) => {
        //   process.once('SIGINT', function () { db.close(); });
        //   const collection = db.collection('orders');
        //   collection.insertMany({
        //     provider: 'gdax.BTC-USD',
        //     "side": "buy",
        //     "target": 2500,
        //     "trailing": { "amount": 50 },
        //     trade: { "percentage": 0.5, "amount": 500 }
        //   }, {
        //       provider: 'gdax.BTC-USD',
        //       "side": "sell",
        //       "target": 3000
        //     });
        // });
      } else if(data.event === 'tick') {
        // mongo.connect((error, db) => {
        //   process.once('SIGINT', function () { db.close(); });
        //   const collection = db.collection('gdax.BTC-USD.aggreagete.minute');
        //   collection.insertMany(data.map(d => {
        //     side

        //   }));
        // });
      }
    },
    error => console.error(new Error(error))
  )
}

function saveTicks(subscribe) {
  subscribe(
    data => {
      mongo.connect((error, db) => {
        const collection = db.collection('gdax.BTC-USD.aggreagete.minute');
        collection.insertMany({
          provider: 'gdax.BTC-USD',
          "side": "buy",
          "target": 2500,
          "trailing": { "amount": 50 },
          trade: { "percentage": 0.5, "amount": 500 }
        },
        {
          provider: 'gdax.BTC-USD',
          "side": "sell",
          "target": 3000
        });
      });
    },
    error => {

    }
  )
}


module.exports = ticker;