#!/usr/bin/env node

const program = require('commander');
const package = require('./package');
const ticker = require('./commands/ticker');
const orders = require('./commands/order');

program
  .version(package.version);

/**
 * ./cli.js ticker
 */
program
  .command('ticker')
  .description('Get market ticks for a given security')
  .action(ticker);

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

program.parse(process.argv);