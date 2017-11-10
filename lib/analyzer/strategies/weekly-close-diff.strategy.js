// ENV=simulation DEBUG='crybot:*' DEBUG_DEPTH=6 DEBUG_HIDE_TTY_DATE=true heroku local analyzer
// ENV=simulation DEBUG='crybot:*' DEBUG_DEPTH=6 DEBUG_HIDE_TTY_DATE=true heroku local
const debug = require('debug')('crybot:WeeklyCloseDiffStrategy');

const security = require('./security');
const strategy = require('./strategy');
const DiffPercentage = require('../indicators/diff-percentage.indicator');

const SECONDS = 1000;
const MINUTES = SECONDS * 60;
const HOURS = MINUTES * 60;

// PROD: recommended between 2 min and 12 hours
// 2 min as minimum, since data is updated every minute or so.
// 12 hours as max, because heroku restarts every 24h, an we want to gurantee at least one check daily
const INTERVAL = 1 * SECONDS; // for debugging

/**
 * Right now only LONG strategies are supported (not margin)
 *
 * When there is a BUY signal, a new buy order will be generated using % or fixed amount via strategy.long.entry.
 * When the SELL signal happens, a db query checks for any BUY order that matches strategy name <WeeklyCloseDiffStrategy>,
 * then a counterpart SELL order is created to SELL for the exact amount or % of the bought amount
 */
class WeeklyCloseDiffStrategy {
  /**
   * Inputs for the stragies
   * @param {*} param0
   */
  constructor({ tickerId = 'gdax.BTC-USD',
                resolution = '7D',
                limit = 2,
                takeProfit = 0.30, // remove?
                thresdhold = 0,
                interval = INTERVAL,
                sellingFactor = 0.50, // sell only 50% of the bought amount
                trailing = { percentage: 0.05, amount: 150 }, // 5% price or $150 price, whatever is less. e.g. 7,000 BTC/USD => +/- Math.min(350,150); 300 ETH/USD => Math.min(15, 150); 50 LTC/USD => Math.min(2.5, 150)
                trade = { quote: 1000} } = {}) {

    this.name = this.constructor.name; // e.g. WeeklyCloseDiffStrategy
    this.order = {
      trade,
      trailing,
      strategyName: this.name,
      target: 0
    };
    this.tickerId = tickerId;
    this.resolution = resolution;
    this.limit = limit;
    this.takeProfit = takeProfit;
    this.closeDiff = new DiffPercentage(limit);
    this.thresdhold = thresdhold;
    this.sellingFactor = sellingFactor;
    this.subscription = null;
    this.interval = interval;


    debug(`WeeklyCloseDiffStrategy %o`, { tickerId, resolution, interval, limit});
  }

  start() {
    this.subscription = security(this.tickerId, this.resolution, this.limit, this.interval).subscribe(
      ticks => {
        this.closeDiff.update(getCloseTicks(ticks));
        const signal = getSignal(this.closeDiff.out, ticks.length);

        // debug('ticks', ticks.length);
        // debug('this.closeDiff.out', this.closeDiff.out)
        // debug('signal', signal);
        // debug('ticks %o', ticks);
        debug('WeeklyCloseDiffStrategy.subscription %o', { n: ticks.length, signal, out: this.closeDiff.out, in: this.closeDiff.in})

        if(signal > this.thresdhold) {
          strategy.long.entry(this);
        } else if (signal < this.thresdhold) {
          strategy.long.exit(this);
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
 * @param {*} diffs array of diffs
* @param {*} numTicks in case we have a diffs.length > numTicks, we only want to get signal for new ticks (numTicks)
 */
function getSignal(diffs, numTicks) {
  const offset = Math.max(1, diffs.length - numTicks);

  for (let index = offset; index < diffs.length; index++) {
    const current = diffs[index];
    const previous = diffs[index-1];
    if (previous < 0 && current > 0) return current; // BUY
    if (previous > 0 && current < 0) return current; // SELL
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