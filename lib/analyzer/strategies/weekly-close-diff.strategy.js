const { security, strategy } = {}
const DiffPercentage = require('../indicators/diff-percentage.indicator');

class WeeklyCloseDiffStrategy {
  /**
   * Inputs for the stragies
   * @param {*} param0
   */
  constructor({ tickerId = 'gdax.BTC-USD',
                resolution = '7D',
                period = 1,
                takeProfit = 0.30,
                tradeQuote = 500} = {}) {

    this.tickerId = tickerId;
    this.resolution = resolution;
    this.period = period;
    this.takeProfit = takeProfit;
    this.tradeQuote = tradeQuote;
    this.closeDiff = new DiffPercentage(52);
    this.subscription = null;
  }

  start() {
    this.subscription = security(this.tickerId, this.resolution, this.period).subscribe(
      ticks => {
        this.closeDiff.update(getCloseTicks(ticks));
        if(hasDiffChange(this.closeDiff.out, ticks.length)) {
          strategy.long(this.tradeQuote, this.takeProfit); // send orders to AMQP
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

function hasDiffChange(array, length) {
  return false;
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