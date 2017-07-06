const gdax = require('../providers/gdax');
const chalk = require('chalk');

function ticker(options) {
  let last, priceColor = chalk.yellow;

  gdax.ticker((d) => {
    if (d.type === 'match') {
      if(last) {
        // const current = +d.price;
        // const change = (current - last) /
        priceColor = last > +d.price ? chalk.red : (last < +d.price ? chalk.green : chalk.gray ) 
      }

      console.log(`${d.product_id} ${d.time}: ${chalk.bold(priceColor(d.price))}  x ${d.size} (${d.type}.${d.side})`);
      
      last = +d.price;
    }    
  });
}

module.exports = ticker;