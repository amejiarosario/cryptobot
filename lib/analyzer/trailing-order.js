const EventEmitter = require('events');
const debug = require('debug')('trailling-order');

/**
 * Trailing Order does a trailing stop/limit for buy and sell to maximize profit
 */
class TrailingOrder extends EventEmitter {
  /**
   * Intialize TrailingOrder with a security
   * @param {String} security - Optional. stock "CSCO" or forex pair "BTC/USD"
   */
  constructor(security) {
    super();
    this.funds = {};
    this.funds.base = 0.0;
    this.funds.quote = 0.0;
    this.order = {};
    this.trigger = {};
    this.security = security;
  }

  /**
   * Set funds for the pair base/quote. e.g. BTC/USD, BTC/ETH
   * @param {Object} params
   */
  setFunds(opts = {}) {
    this.funds.base = btc(opts.base) || 0.0;
    this.funds.quote = usd(opts.quote || opts || 0.0);
  }

  /**
   *
   * @param {Object} value - object with all the limit triggers and actions
   */
  setOrder(value) {
    try {
      // this.validate(value);
      this.orders = value;
      this.trigger = {};
      (this.orders || []).forEach((order, index) => {
        this.validate(order);
        this.checkTradeSignal(order, index);
      });
    } catch (error) {
      const msg = `ERROR: order is incorrect ${error}`;
      this.emit('error', msg);
      console.error(msg);
    }
  }

  validate(order) {
    debug('***');

    if (!['sell', 'buy'].includes(order.side)) {
      throw `ERROR: parsing order. Side should be either buy or sell. Given ${side}`
    }

    if(!order.target) {
      throw `No target price specified!`;
    }

    let trend;
    if(order.side === 'sell') {
      trend = 'higher';
    } else {
      trend = 'lower';
    }

    debug(`${order.side}ing WHEN price reaches ${order.target} or ${trend}`);
    debug(`Trading ${order.trade} with these funds ${this.funds}`);
    debug('***');
  }

  /**
   * Set current price
   * @param {Float} value current price value
   */
  setPrice(value) {
    const price = parseFloat(value);

    this.trigger.current = price;
    (this.orders || []).forEach((order, index) => this.checkTradeSignal(order, index));
  }

  checkTradeSignal(order, index) {
    const {
      side,
      target,
      trailing,
      trade
    } = order;

    const price = this.trigger.current;
    let trigger = {}
    let tradeSize = calculateTradeSize(price, this.funds, order.trade);
    let trailBounds = calculateBounds(price, order.trailing);
    let quoteSize = 0, baseSize = 0;
    let size;

    // check if trailing limits are met
    if (side === 'sell' && price >= target) {
      trigger.price = trailBounds.lower;
      trigger.trail = trailBounds.upper;
    } else if (side === 'buy' && price <= target) {
      trigger.price = trailBounds.upper;
      trigger.trail = trailBounds.lower;
    }

    // check if trade trigger are met
    if (side === 'buy' && this.trigger.buy && price >= this.trigger.buy.price) {
      size = tradeSize.buy;
      // set new funds
      if(size > 0) {
        this.funds.base += size;
        this.funds.quote -= size * price;
      }

    } else if (side === 'sell' && this.trigger.sell && price <= this.trigger.sell.price) {
      size = tradeSize.sell;

      // set new funds
      if(size > 0) {
        this.funds.base -= size;
        this.funds.quote += size * price;
      }
    }

    // set new triggers and trade price
    if (trigger.price && trigger.trail) {
      this.trigger[side] = trigger;
    }

    if(typeof size === 'undefined') {
      return;
    }

    // delete orders and trigger if the trigger price was met and order size was set
    this.orders.splice(index, 1); // delete order
    delete this.trigger[side]; // delete triggers

    // if the orders size was zero then fail
    if(size <= 0) {
      this.emit('error', `Not enough funds ${str(this.funds)} to ${side}: ${str(order.trade)} @ ${price}`);
      return;
    }

    // if the order size is bigger than zero then execute
    if(size > 0) {
      this.emit('trade', { side, size, price });
    }
  }
}

// convert to BTC with eigth decimals (1 satoshi)
function btc(amount) {
  return +(parseFloat(amount).toFixed(8));
}

// convert to usd format
function usd(amount) {
  return +(parseFloat(amount).toFixed(4));
}

// convert to string
function str(json) {
  return JSON.stringify(json);
}

function calculateBounds(price, trailing = {}) {
  let upper = price;
  let lower = price;

  const amount = parseFloat(trailing.amount);
  const percentage = trailing.percentage * price;

  let modifier = 0;

  if(amount > 0) {
    modifier = amount;
  }

  if(percentage > 0) {
    modifier = amount > 0 ? Math.min(amount, percentage) : percentage;
  }

  upper += modifier;
  lower -= modifier;

  return {upper: usd(upper), lower: usd(lower)};
}

/**
 * Return size or order if it is sold or bought
 * @param {Number} price
 * @param {Object} funds funds available
 * @property {Number} funds.base base currency e.g. BTC
 * @property {Number} funds.quote quote currency e.g. USD
 * @param {Object} trade
 * @property {Number} trade.amount amount of funds to trade in quote currency e.g. USD
 * @property {Number} trade.percentage percentage of funds to trade
 */
function calculateTradeSize(price, {base, quote}, trade = {}) {
  let buy = 0, sell = 0, newQuoteSize, newBaseSize;

  const amount = btc(parseFloat(trade.amount || 0.0)/price); // default to 0 if not specified
  const percentageFunds = parseFloat(trade.percentage) || 1; // default to trade all funds if not specified
  const percentageFundsQuote = percentageFunds * quote;
  const percentageFundsBase = percentageFunds * base;

  // Choose the minimun amount between percentage of funds or trade amount.

  buy = btc(percentageFundsQuote / price);
  if(amount > 0) {
    buy = Math.min(amount, buy);
  }

  sell = percentageFundsBase;
  if(amount > 0) {
    sell = Math.min(amount, sell);
  }

  return { buy, sell};
}

module.exports = TrailingOrder;