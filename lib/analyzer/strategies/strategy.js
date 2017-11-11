const uuid = require('uuid');
const amqp = require('../../messaging/amqp');
const mongo = require('../../ticker/db');
const debug = require('debug')('crybot:strategy');

/**
 * Create order based on strategy.
 *
 * See https://www.tradingview.com/wiki/Strategies
 *
 * Ideas:
 *
 * 1. use only orders collection, but will cause overselling if only want to sell 50% of last trade.
 * 2. strategies {stategyName: '', side: 'buy', ...}
 */

const Long = {
  entry: function (strat) {
    // only one entry should be open at a time.
    mongo.getLastOrdersByStrategy({ strategyName: strat.name, provider: strat.tickerId }).then(([entryOrder, exitOrder]) => {
      if (entryOrder && entryOrder.status !== 'done') {
        debug('Already another entry order is open. %o', entryOrder);
      } else if (entryOrder && entryOrder.status === 'done') {
        sendOrder(strat, 'buy', new Date(), { type: 'long', position: 'entry' });
      }
    });
  },

  exit: function (strat) {
    // *** group by $sum: 'position.size' strategies that matches {strategyName = weeklyClose, side = buy, status = done}
    // if is bigger than 0, then run create a counter order by % or the exact number.
    // e.g. if there are 10 + 20 = 30 was bought, then the exit could be sell $30 or a percentage (e.g. 0.50 => $15)

    // *** have orders have a entry/exit embedded details so it's easy to see if an order has been closed or not.

    mongo.getLastOrdersByStrategy({ strategyName: strat.name, provider: strat.tickerId }).then(([entryOrder, exitOrder]) => {
      if(exitOrder) {
        debug(`Exit order already posted! `)
        console.warn(`Exit order already posted! `);
      } else if (entryOrder && entryOrder.status === 'done') {
        const newStrat = Object.assign({}, strat);
        newStrat.order.trade.base = entryOrder.position.size * newStrat.sellingFactor;
        sendOrder(newStrat, 'sell', entryOrder.entryOrderCreated, {type: 'long', position: 'exit'});
      } else {
        debug(`No executed entry order found for ${strat.name}. Should we short it?`);
        console.warn(`No executed entry order found for ${strat.name}. Should we short it?`);
      }
    });
  }
}

const Short = {
  entry: function (strat) {

  },

  exit: function (strat) {

  }
}

 const Strategy = {
  long: Long,
  short: Short
}

function sendOrder(strat, side, entryOrderCreated, details = {}) {
  const order = Object.assign({}, strat.order);
  order.side = side;
  if (entryOrderCreated) {
    order.entryOrderCreated = entryOrderCreated
  }
  order.strategyDetails = details;
  order.strategyDetails.timestamp = new Date();
  order.saved = true; // so it doesn't get saved with a 0 price

  const payload = {};
  payload[strat.tickerId] = [order];

  amqp.client(payload, (error, data) => {
    debug('About to send order %o', payload);
    console.log('sendOrder.payload', error, payload);
  });
}

module.exports = {Strategy};

/**

  {
    "gdax.LTC-USD": [
        {
            "side": "sell",
            "target": 90,
            "_id": "59df334586dc611d98153cc5",
            "trailing": {
                "amount": 5
            },
            "trade": {
                "amount": 0.95
            }
        }
    ]
  }

 */