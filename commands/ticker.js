const chalk = require('chalk');
const program = require('commander');

const gdax = require('./gdax');
const db = require('../db');
const netcli = require('./socket-cli');
const TrailingOrder = require('../lib/trailing-order');
const callback = require('./helper').callback;

function ticker(options) {
  let last, sequence, color = chalk.yellow;

  const trailingOrder = new TrailingOrder('BTC/USD');

  function trade(params) {
    console.log('trading...', params);
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
  netcli.server((socket) => {
    socket.setEncoding('utf-8');
    // 'connection' listener
    socket.on('end', () => {
      console.log('client disconnected');
    });

    socket.on('data', (res) => {
      if (res.match(/^close/i)) {
        socket.end('bye!\r\n');
      
      } else if(res.match(/^order/i)) {
        socket.write(JSON.stringify(trailingOrder.order));
      
      } else {
        try {
          console.log(res);
          const order = JSON.parse(res);
          console.log('setting order to ', order)
          trailingOrder.setOrder(order);
          socket.write(`${JSON.stringify(trailingOrder.order)}`);
        } catch (error) {
          socket.write(`ERROR: failed setting order. ${error}, ${res}\r\n`);
        }
      }
    });
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