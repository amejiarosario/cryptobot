const chalk = require('chalk');

const gdax = require('../providers/gdax');
const db = require('../db');

function ticker(options) {
  let last, sequence, color = chalk.yellow;

  console.error('Testing error message');

  db.connect((err, dbi) => {
    if(err) console.error('ERROR connecting to database. ', err);

    const collection = dbi.collection(`btc-usd-ticker`);

    gdax.ticker((data) => {
      // check sequence
      if (sequence && sequence !== (+data.sequence - 1) ) {
        console.error(`ERROR sequence ${sequence} didn't match data.sequence ${data.sequence} `);
      }

      sequence = data.sequence;

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
          if(err) console.error('ERROR inserting document', err);
        });

        last = current;
      }
    });
  });
}

module.exports = ticker;