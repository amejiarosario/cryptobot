#!/usr/bin/env node

const program = require('commander');
const package = require('./package');
const ticker = require('./commands/ticker');

program
  .version(package.version);

program
  .command('ticker')
  .action(ticker);

program.parse(process.argv);