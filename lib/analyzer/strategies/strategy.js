const uuid = require('uuid');
const amqp = require('../../messaging/amqp');

/**
 * Create order based on strategy
 */
class Strategy {
  static long(strat) {
    const order = {};
    const orderSide = getStratParams(strat);

    order[strat.tickerId] = [
      Object.assign({ side: 'buy' }, orderSide),
      Object.assign({ side: 'sell' }, orderSide)
    ]
    amqp.client(order);
  }

  // TODO: needs to implement margin trading
  static short(strat) {
    const order = {};
    amqp.client(order);
  }
}

function getStratParams(strat) {
  // get current price orderbook and know the MAKER price (set order to that)
  const price = 0;

  // (optional) get funds to know if I can make order or not

  return {
    strategyName: strat.constructor.name,
    strategyId: uuid(),
    target: price,
    trade: strat.trade,
    trailing: strat.trailing
  };
}

module.exports = Strategy;