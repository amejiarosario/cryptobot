/**
 * Analyzer
 *
 * This module perform the Technical Analisys with data from (mongo) db.
 *
 * Based on the data it will trigger:
 *  - entry strategy (buy) and
 *  - exit stregies (sell with take-profit [T/P] and stop-loss [S/L])
 *
 * Analyzer gets notified through AMQP when a new insert is made in the db
 * When Analyzer needs to send a signal (entry/exit) it will do it through AMQP like the regular orders
 *
 * Info
 *  - http://www.investopedia.com/articles/trading/04/092904.asp
 */
const config = require('../../config');
const amqp = require('../messaging/amqp');

class Analyzer {
  constructor() {
    // loading strategy
    this.strategy = require(`./${config.analyzer.strategy}.strategy`);
    this.getHistory();
    this.listenForNewData();
    this.listenForStrategySignals();
  }

  /**
   * Send entry/exit signal
   */
  listenForStrategySignals() {

  }

  /**
   * Get historic data from db and feed the strategy
   */
  getHistory() {
  }

  listenForNewData() {
    amqp.receive(handler => {
      console.log('handler', JSON.stringify(handler));
      // this.strategy.update(handler.msg);
    });
  }
}


module.exports = {}