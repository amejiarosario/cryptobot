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
module.exports = {}