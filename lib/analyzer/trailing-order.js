const EventEmitter = require('events');
const debug = require('debug')('crybot:trailling-order');
const PAIR_REGEX = /([a-zA-Z]*)[^a-zA-Z]([a-zA-Z]*)/;
// const {callback} = require('../common/helper');
const uuid = require('uuid');

/**
 * Trailing Order does a trailing stop/limit for buy and sell to maximize profit
 */
class TrailingOrder extends EventEmitter {
  /**
   * Intialize TrailingOrder with a security
   * @param {String} security - Optional. forex pair "BTC/USD"
   */
  constructor(security = 'BTC-USD') {
    super();
    this.uuid = uuid();
    this.funds = {};
    this.funds.base = 0.0;
    this.funds.quote = 0.0;
    this.order = {};
    this.setSecurity(security);
    // this.executeTrade = noop;
    // this.getFunds = noop;
  }

  setSecurity(val) {
    [this.security, this.baseSymbol, this.quoteSymbol] = val.match(PAIR_REGEX) || [];
  }

  /**
   * Set funds for the pair base/quote. e.g. BTC/USD, BTC/ETH
   * @param {Object} params
   */
  setFunds(opts = {}) {
    // parse array of funds
    if(Array.isArray(opts)) {
      opts = opts.reduce((a, f) => {
        a[f.currency] = f.available;
        return a;
      }, {});
    }

    if(!opts) { // case opts is null
      opts = {};
    }

    this.funds.base = btc(opts[this.baseSymbol] || opts.base || 0.0);
    this.funds.quote = usd(opts[this.quoteSymbol] || opts.quote || 0.0);
    debug(`Funds updated %o`, this.funds);
  }

  setGetFundsAction(fn) {
    this.getFunds = fn;
  }

  setExecuteTradeAction(fn) {
    this.executeTrade = fn;
  }

  /**
   *
   * @param {Object} value - object with all the limit triggers and actions
   */
  setOrder(value) {
    try {
      // this.validate(value);
      this.orders = value;
      (this.orders || []).forEach((order, index) => {
        this.validate(order);
        this.checkTradeSignal(order, index);
      });
    } catch (error) {
      const msg = `ERROR: order is incorrect ${error}`;
      this.emit('error', msg);
      console.error(msg.stack);
    }
  }

  validate(order) {

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

    debug(`*** ${order.side.toUpperCase()}ing WHEN price reaches %o or ${trend}`, order.target);
    debug(`Trading %o with these funds %o`, order.trade, this.funds);
    debug(`Trailing is %o ***`, order.trailing);
  }

  /**
   * Set current price
   * @param {Float} value current price value
   */
  setPrice(value) {
    const price = parseFloat(value);

    this.price = price;
    (this.orders || []).forEach((order, index) => this.checkTradeSignal(order, index));
  }

  checkTradeSignal(order, index) {
    const {
      side,
      target,
      trailing,
      trade
    } = order;

    order.trigger = order.trigger || {};

    const price = this.price;

    // check if trade trigger are met
    if (side === 'buy' && order.trigger.buy && price >= order.trigger.buy.price ||
      side === 'sell' && order.trigger.sell && price <= order.trigger.sell.price) {

      // delete orders and trigger if the trigger price was met.
      // Very important!! Otherwise orders can be executed multiple times
      this.orders.splice(index, 1); // delete order
      debug(`[Trading] Trigger price met: %o -- ${price}`, order.trigger);

      if(this.getFunds) {
        this.getFunds((error, response, funds) => {
          if (error || (response && response.statusCode !== 200)) {
            this.emit('error', `Error getting funds. statusCode=${(response && response.statusCode)} error=${error || data}`);
          } else {
            this.setFunds(funds);
            this.makeTrade({ price, side, order });
          }
        });
      } else {
        debug(`[Trading] making trade WITHOUT updating funds`);
        this.makeTrade({ price, side, order });
      }

      return;
    }

    let trailBounds = calculateBounds(price, order.trailing);

    // check if trailing limits are met
    if (side === 'sell' && price >= target) {
      const trigger = {};
      trigger.price = trailBounds.lower;
      trigger.trail = trailBounds.upper;
      this.updateTrigger(side, order, trigger);
    } else if (side === 'buy' && price <= target) {
      const trigger = {};
      trigger.price = trailBounds.upper;
      trigger.trail = trailBounds.lower;
      this.updateTrigger(side, order, trigger);
    }
  }

  /**
   * set new triggers and trade price
   * @param {*} side
   * @param {*} trigger
   */
  updateTrigger(side, order, trigger) {
    if (!order.trigger[side] ||
      (side === 'buy' && order.trigger[side].trail > trigger.trail && this.price < order.trigger[side].trail ||
      side === 'sell' && order.trigger[side].trail < trigger.trail && this.price > order.trigger[side].trail)
    ) {
      order.trigger[side] = trigger;
      debug(`[Trailing] Trigger for ${this.security} ${side} @ ${order.target} has change %o --- %o --- to: %o`, this.price, order.trigger, this.uuid);
    }
  }

  makeTrade({price, side, order}) {
    let tradeSize = calculateTradeSize(price, this.funds, order.trade);
    let size;

    if (side === 'buy') {
      size = tradeSize.buy;
      // set new funds
      if (size > 0) {
        this.funds.base += size;
        this.funds.quote -= size * price;
      }
    } else {
      size = tradeSize.sell;
      // set new funds
      if (size > 0) {
        this.funds.base -= size;
        this.funds.quote += size * price;
      }
    }

    if (typeof size === 'undefined') {
      this.emit('error', `calculated size is undefined`);
      return;
    }

    // if the orders size was zero then fail
    if (!size || size <= 0) {
      this.emit('error', `Not enough funds ${str(this.funds)} to ${side}: ${str(order.trade)} @ ${price}`);
      return;
    }

    // if the order size is bigger than zero then execute
    if (size > 0) {
      const tradeParams = {
        order,
        trade: { side, size, price, product_id: this.security }
      };

      debug(`[Trading] Executing trade for ${this.security} ${side} @ ${order.target} - Trade: %o`, tradeParams.trade);

      delete order.trigger; // delete trigger since is not needed for nothing else

      if (this.executeTrade) {
        this.executeTrade(tradeParams.trade, (error, response, data) => {
          if (error || (response && response.statusCode !== 200)) {
            // TODO: wrap errors with Error() so it can have stack trace...
            this.emit('error', `Error executing trade. statusCode=${response.statusCode} error=${JSON.stringify(error || data)}`);
          } else {
            tradeParams.result = data;
            this.emit('trade', tradeParams);
          }
        });
      } else {
        this.emit('trade', tradeParams);
      }
    }
  }

  toString() {
    return JSON.stringify(this.toObject());
  }

  toObject() {
    return {
      uuid: this.uuid,
      security: this.security,
      price: this.price,
      funds: this.funds,
      orders: this.orders,
      trade: this.trade
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
  let buy = 0.0, sell = 0.0, newQuoteSize, newBaseSize;

  const amount = btc(parseFloat(trade.amount || 0.0)/price); // default to 0 if not specified
  const percentageFunds = parseFloat(trade.percentage) || 1; // default to trade all funds if not specified
  const percentageFundsQuote = usd(percentageFunds * quote);
  const percentageFundsBase = btc(percentageFunds * base);

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

function noop(a, b) {
  try {
    if (a) a();
    if (b) b();
  } catch (error) {

  }
}

module.exports = TrailingOrder;