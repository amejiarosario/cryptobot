#!/usr/bin/env node

const program = require('commander');
const package = require('./package');
const ticker = require('./commands/ticker');
const orders = require('./commands/orders');

program
  .version(package.version);

program
  .command('ticker')
  .description('Get market ticks for a given security')
  .action(ticker);

program
  .command('orders')
  .description('Shows current open orders')
  .action(orders);

program.parse(process.argv);