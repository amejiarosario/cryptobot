const SATOSHI = 0.00000001;
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
  setFunds(opts) {
    this.funds.base = btc(opts.base) || 0.0;
    this.funds.quote = usd(opts.quote || opts || 0.0);
  }

  /**
   *
   * @param {Object} value - object with all the limit triggers and actions
   */
  setOrder(value) {
    try {
      this.validate(value);
      this.order = value;
      delete this.newBuyTrail;
      delete this.buyingPrice;
      delete this.newSellTrail;
      delete this.sellingPrice;
      delete this.last
      this.checkLimits(this.last);
    } catch (error) {
      console.error('ERROR: order is incorrect', error);
    }
  }

  validate(order) {
    console.log('***');
    if(order.buy) {
      const { price: buyPrice, trailing: buyTrailing, action: buyAction, percentage: buyPercentage, amount } = order.buy;
      console.log(order.buy);
      console.log(`When PRICE reach ${buyPrice} or lower (+/- ${buyTrailing * 100}% => ${buyPrice * (1 + buyTrailing)} to ${buyPrice * (1 - buyTrailing)})`);
      console.log(`then BUY ${btc(this.funds.quote * buyPercentage / buyPrice)} BTC with`);
      if (amount > 0 && amount < (this.funds.quote * buyPercentage)) {
        console.log(amount);
      } else {
        console.log(`${usd(this.funds.quote * buyPercentage)} USD(${buyPercentage * 100} % of ${this.funds.quote})`)
      }
    }

    if(order.sell) {
      const { price: sellPrice, trailing: sellTrailing, action: sellAction, percentage: sellPercentage, amount } = order.sell;
      console.log(order.sell);
      console.log(`When PRICE reach ${sellPrice} or higher (+/- ${sellTrailing * 100}%), then SELL ${btc(this.funds.base * sellPercentage)} BTC for`);
      if (amount > 0 && amount < (this.funds.base * sellPercentage)) {
        console.log(amount);
      } else {
        console.log(`${usd(this.funds.base * sellPercentage * sellPrice)} USD (${sellPercentage * 100}% of ${this.funds.base})`)
      }
    }
    console.log('***');
  }

  /**
   * Set current price
   * @param {Float} value current price value
   */
  setPrice(value) {
    const price = parseFloat(value);
    this.last = price; // TODO: remove
    this.checkLimits(this.last); // TODO: remove

    this.trigger.current = price;
    (this.orders || []).forEach((order) => this.checkTradeSignal(order));
  }

  checkTradeSignal(order) {
    const {
      side,
      target,
      trailing,
      trade
    } = order;

    const price = this.trigger.current;
    let trigger = {};

    if(!['sell', 'buy'].includes(side)) {
      console.error('ERROR: parsing order. Side should be either buy or sell. Given ', side);
      return;
    }

    let tradeSize = calculateTradeSize(price, this.funds, order.trade);
    let trailBounds = calculateBounds(price, order.trailing);
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
    if (this.trigger.buy && price >= this.trigger.buy.price) {
      size = tradeSize.buy;

    } else if (this.trigger.sell && price <= this.trigger.sell.price) {
      size = tradeSize.sell;
    }

    if (trigger.price && trigger.trail) {
      this.trigger[side] = trigger;
    }

    if(size <= 0) {
      this.emit('error', `Not enough funds ${str(this.funds)} to ${side}: ${str(order.trade)} @ ${price}`);
      return;
    }

    if(size && size > 0) {  // just to make sure :)
      this.emit('trade', { side, size, price });
    }
  }

  /**
   * Check if current price has gone off limits and execute associated action
   */
  checkLimits(current) {
    if(!current) {
      return;
    }

    if (this.order && this.order.buy) {
      const { price: buyPrice, trailing: buyTrailing, action: buyAction, percentage: buyPercentage, amount: buyAmount = 0 } = this.order.buy;
      this.newBuyTrail = this.newBuyTrail || buyPrice;

      if (current <= this.newBuyTrail) {
        this.buyingPrice = current * (1 + buyTrailing);
        this.newBuyTrail = current * (1 - buyTrailing);
        console.log('new values', current, buyTrailing, current * (1 + buyTrailing), current * (1 - buyTrailing))
      } else if (this.buyingPrice && current >= this.buyingPrice) {
        // update funds
        let tradingFunds = this.funds.quote * buyPercentage;  // USD
        if (buyAmount > 0) {
          tradingFunds = Math.min(tradingFunds, buyAmount);
        }

        if(tradingFunds <= SATOSHI) {
          this.emit('buy', `ERROR: No funds to make the buy! ${str(this.funds)}`);
        } else {
          const size = btc(tradingFunds / current);
          const buyParams = {
            side: 'buy',
            price: current,
            size: size
          };

          this.funds.base += size;

          // execute order
          buyAction && buyAction(buyParams);

          this.emit('buy', null, buyParams);
        }

        // remove order
        delete this.order.buy;
      }
    }

    // selling
    if (this.order && this.order.sell) {
      const { price: sellPrice, trailing: sellTrailing, action: sellAction, percentage: sellPercentage, amount: sellAmount = 0 } = this.order.sell;
      this.newSellTrail = this.newSellTrail || sellPrice;

      if (current >= this.newSellTrail) {
        this.sellingPrice = current * (1 - sellTrailing);
        this.newSellTrail = current * (1 + sellTrailing);
      } else if (this.sellingPrice && current <= this.sellingPrice) {
        // update funds
        let size = btc(this.funds.base * sellPercentage);
        if (sellAmount > 0) {
          size = Math.min(size, btc(sellAmount/current));
        }
        this.funds.base -= size; // selling btc
        this.funds.quote += size * current; // buying usd

        if(size <= SATOSHI) {
          console.error(`ERROR: No funds to make the sell! ${str(this.funds)}`);
          this.emit('sell', `ERROR: No funds to make the sell! ${str(this.funds)}`);
        } else {
          const sellParams = {
            side: 'sell',
            price: current,
            size: size
          };

          // execute order
          sellAction && sellAction(sellParams);

          this.emit('sell', null, sellParams);
        }

        // delete order
        delete this.order.sell;
      }
    }

    // console.log(current, JSON.stringify(this));
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

  const amount = trailing.amount;
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

  return {upper, lower};
}

/**
 * Return size on parameter
 * @param {*} price
 * @param {*} param1
 * @param {*} param2
 */
function calculateTradeSize(price, {base, quote}, trade = {}) {
  let buy = 0, sell = 0;
  const amount = trade.amount;
  const percentage = (trade.percentage || 0) * quote;

  if(amount && quote >= amount) {
    buy = btc(amount/price);
  }

  if (percentage > 0 && percentage <= quote) {
    const buyPercentage = btc(percentage / price);
    buy = buy > 0 ? Math.min(buy, buyPercentage) : buyPercentage;
  }

  if(!percentage && !amount) {
    buy = base;
    sell = base;
  }

  // size
  return {buy, sell};
}

module.exports = TrailingOrder;