const chalk = require('chalk');
const program = require('commander');

const gdax = require('../providers/gdax'); // TODO: create an interface where all the providers can be easily interchanged
const db = require('./db');
const amqp = require('../messaging/amqp')
const TrailingOrder = require('../analyzer/trailing-order');
const callback = require('../common/helper').callback;

function ticker(options) {
  let last, sequence, color = chalk.yellow;

  const trailingOrder = new TrailingOrder('BTC/USD');

  function trade(error, params) {
    console.log('trading...', params);
    if(err) console.error(error);
    gdax.setOrder(params, callback);
    setTimeout(updateFunds, 5e3);
  }

  trailingOrder.on('buy', trade);
  trailingOrder.on('sell', trade);
  
  // get available funds
  function updateFunds() {
    gdax.authedClient.getAccounts((err, status, data) => {
      if (err) console.error('ERROR: getting accounts funds ', err);

      const btc = data.filter((d) => d.currency === 'BTC')
      const usd = data.filter((d) => d.currency === 'USD');

      console.log('FUNDS: ');
      data.map((d) => {
        console.log(`${d.currency}: ${d.available}`);
      });

      trailingOrder.setFunds({
        base: btc[0].available,
        quote: usd[0].available
      });
    });
  }
  updateFunds();

  // telnet localhost 7777 | {"lte": 2520, "gte": 2521}
  amqp.server((message) => {
    if (message.match(/^close/i)) {
      return 'bye';

    } else if (message.match(/^order/i)) {
      return JSON.stringify(trailingOrder.order);

    } else {
      try {
        console.log(message);
        const order = JSON.parse(message);
        console.log('setting order to ', order)
        trailingOrder.setOrder(order);
        return JSON.stringify(trailingOrder.order);

      } catch (error) {
        return `ERROR: failed setting order. ${error}, ${message}`
      }
    }
  });

  db.connect((err, dbi) => {
    if(err) console.warn('ERROR connecting to database. ', err);
    console.log(`Mongo: Connected correctly to server: ${dbi.serverConfig.host}:${dbi.serverConfig.port}/${dbi.databaseName}`);   

    const collection = dbi.collection(`btc-usd-ticker`);

    gdax.ticker((data) => {
      // check sequence
      if (sequence && sequence !== (+data.sequence - 1) ) {
        console.warn(`ERROR sequence ${sequence} didn't match data.sequence ${data.sequence} `);
      }

      sequence = data.sequence;

      if (data.type === 'match') {
        const current = parseFloat(data.price);
        if (!last) { last = current; }
        const diff = (current - last).toFixed(4);
        const change = (diff * 100 / last).toFixed(4);
        const color = diff > 0 ? chalk.green : (diff < 0 ? chalk.red : chalk.gray);

        trailingOrder.setPrice(current);

        console.log(`${data.time} (${data.type}): ${data.side} \t ${data.product_id} ${data.size} @ ${data.price} \t ${color(diff)} ${color(change)}% \t ${JSON.stringify(trailingOrder)}`);

        collection.insertOne({
          time: new Date(data.time),
          price: +data.price,
          size: +data.size,
          side: data.side
        }, (err, d) => {
          if(err) console.warn('ERROR inserting document', err);
        });

        last = current;
      }
    });
  });
}

module.exports = ticker;