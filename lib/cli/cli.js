#!/usr/bin/env node

const program = require('commander');
require('events').EventEmitter.prototype._maxListeners = 100;

const package = require('../../package');
const {ticker} = require('../ticker/ticker');
const orders = require('../ticker/order');

function setupProgram() {
  program
    .version(package.version);

  /**
   * bin/cli ticker --provider gdax:BTC-USD,ETH-USD --provider poloniex:BTC-ETH --modifier bufferTime:30000
   * DEBUG=* node bin/cli ticker --provider gdax:BTC-USD,ETH-USD --modifier bufferTime:30000
   */
  program
    .command('ticker')
    .description('Get market ticks for a given security')
    .option('-p, --provider <provider>', 'provider: products id. e.g. gdax:BTC-USD,ETH-USD', parseToObjectList, {})
    .option('-m, --modifier <modifier>', 'modifier: products id. e.g. bufferTime:30000', parseToObject, {})
    .action((options) => {
      ticker(options.provider, options.modifier)
    });

  /**
   * ./cli.js order
   * ./cli.js order --side buy --size 0.04 --price 2500
   * ./cli.js order --cancel
   */
  program
    .command('order')
    .description('Shows current open orders')
    .option('-s --side <side>', 'buy or sell', /^(sell|buy)$/i)
    .option('-p --price <price>', 'Price per bitcoin', parseFloat)
    .option('-vol --size <size>', 'Amount of BTC to buy or sell', parseFloat)
    .option('-c --cancel [orderId]', 'Cancel all orders or the one with the order id')
    .action(orders);

  program
    .command('*')
    .action(() => program.help());

    return program;
}

function parseToObjectList(val, map) {
  const [provider, productIds] = val.split(':');
  map[provider] = productIds.split(',');
  return map;
}

function parseToObject(val, map) {
  const [key, value] = val.split(':');
  map[key] = value;
  return map;
}

module.exports = setupProgram;