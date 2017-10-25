// ENV=simulation DEBUG='crybot:*' DEBUG_DEPTH=6 DEBUG_HIDE_TTY_DATE=true heroku local analyzer
// ENV=simulation DEBUG='crybot:*' DEBUG_DEPTH=6 DEBUG_HIDE_TTY_DATE=true heroku local
const debug = require('debug')('crybot:weekly-close-diff-strategy');

const security = require('./security');
const strategy = require('./strategy');
const DiffPercentage = require('../indicators/diff-percentage.indicator');

const SECONDS = 1000;
const MINUTES = SECONDS * 60;
const HOURS = MINUTES * 60;
const INTERVAL = 10 * SECONDS; // for debugging

class WeeklyCloseDiffStrategy {
  /**
   * Inputs for the stragies
   * @param {*} param0
   */
  constructor({ tickerId = 'gdax.BTC-USD',
                resolution = '7D',
                limit = 2,
                takeProfit = 0.30,
                thresdhold = 0,
                interval = INTERVAL, // recommended between 2 min and 12 hours
                // interval = 5 * SECONDS, // recommended between 2 min and 12 hours
                trailing = {},
                trade = {quote: 500}} = {}) {

    this.tickerId = tickerId;
    this.resolution = resolution;
    this.limit = limit;
    this.takeProfit = takeProfit;
    this.trade = trade;
    this.trailing = trailing;
    this.closeDiff = new DiffPercentage(limit);
    this.thresdhold = thresdhold;
    this.subscription = null;
    this.interval = interval;
  }

  start() {
    this.subscription = security(this.tickerId, this.resolution, this.limit, this.interval).subscribe(
      ticks => {
        this.closeDiff.update(getCloseTicks(ticks));
        const diffChange = hasDiffChange(this.closeDiff.out, ticks.length);

        debug('ticks %o', ticks);
        debug('this.closeDiff.out', this.closeDiff.out, 'diffChange: ', diffChange);

        if(diffChange > this.thresdhold) {
          // LONG possition (buy low and sell higher)
          // create a buy and sell order on 30% profit (use this.constructor.name)
          // strategy.long(this.tradeQuote, this.takeProfit); // send orders to AMQP
          strategy.long(this);
        } else if (diffChange < this.thresdhold) {
          // SHORT position (sell (high) borrowing from broker and buy (lower) to pay back broker)
          // COULD replace the previous take profit (if hasn't happen) and create a sell order
          // strategy.short(this.tradeQuote, this.takeProfit); // send orders to AMQP
          strategy.short(this);
        }
      },
      error => console.error(error)
    );
  }

  stop() {
    if(this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}

function getCloseTicks(arrayOrSingle) {
  if(Array.isArray(arrayOrSingle)) {
    return arrayOrSingle.map(t => t.close);
  } else {
    return arrayOrSingle.close;
  }
}

/**
 * Returns 0 if has been no change crossing 0. +1 if there has been a change from -diff to +diff and -1 if the opposite happens
 * @param {*} diffs
 * @param {*} length
 */
function hasDiffChange(diffs, length) {
  for (let index = diffs.length - length; index < diffs.length; index++) {
    if(index === 0) continue;
    const current = diffs[index];
    const previous = diffs[index-1];
    if(previous < 0 && current > 0) return 1; // BUY
    if(previous > 0 && current < 0) return -1; // SELL
  }
  return 0;
}

module.exports = WeeklyCloseDiffStrategy;

/**
 *

//@version=2
strategy("Daily Close Comparison Strategy (by ChartArt)", shorttitle="weekly close", overlay=false, initial_capital = 750, commission_type = strategy.commission.percent, commission_value = 0.25)

threshold = input(title="Price Difference Threshold", type=float, defval=0, step=0.001)

resolution = input('7D') // ohlc = 1D

getDiff() =>
    yesterday=security(tickerid, resolution, close[1])
    today=security(tickerid, resolution, close)
    delta=today-yesterday
    percentage=delta/yesterday

closeDiff = getDiff()

buying = closeDiff > threshold ? true : closeDiff < -threshold ? false : buying[1]

hline(0, title="zero line")

bgcolor(buying ? green : red, transp=90)

plot(closeDiff, color=silver, style=area, transp=10)
plot(closeDiff, color=aqua, title="prediction")

longCondition = buying
if (longCondition)
    strategy.entry("Buy", strategy.long)

shortCondition = buying != true
if (shortCondition)
    strategy.entry("Sell", strategy.short)


/////////////


This is great for long term investments (trades every 15 days)

 */