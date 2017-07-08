#!/usr/bin/env node

const program = require('commander');
const package = require('./package');
const ticker = require('./commands/ticker');
const orders = require('./commands/order');

program
  .version(package.version);

program
  .command('ticker')
  .description('Get market ticks for a given security')
  .action(ticker);

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