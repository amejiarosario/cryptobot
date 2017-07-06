const chalk = require('chalk');

const gdax = require('../providers/gdax');
const db = require('../db');

function ticker(options) {
  let last, color = chalk.yellow;

  db.connect((err, dbi) => {
    const collection = dbi.collection(`btc-usd-ticker`);

    gdax.ticker((data) => {
      if (data.type === 'match') {
        const current = +data.price;
        if (!last) { last = current; }
        const diff = (current - last).toFixed(4);
        const change = (diff * 100 / last).toFixed(4);
        const color = diff > 0 ? chalk.green : (diff < 0 ? chalk.red : chalk.gray);

        console.log(`${data.time} (${data.type}): ${data.side} \t ${data.product_id} ${data.size} @ ${data.price} \t ${color(diff)} ${color(change)}%`);

        collection.insertOne({
          time: new Date(data.time),
          price: +data.price,
          size: +data.size,
          side: data.side
        }, (err, d) => {
          if(err) console.error(err);
        });

        last = current;
      }
    });
  });
}

module.exports = ticker;