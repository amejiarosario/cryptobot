const chalk = require('chalk');
const gdax = require('./gdax');
const db = require('../db');
const netcli = require('./socket-cli');
const program = require('commander');
const TrailingOrder = require('../lib/trailing-order');

function ticker(options) {
  let last, sequence, color = chalk.yellow;

  const trailingOrder = new TrailingOrder('BTC/USD');

  trailingOrder.on('buy', (params) => {
    console.log('buying... nothing', params);
    updateFunds();
  });

  trailingOrder.on('sell', (params) => {
    console.log('buying... nothing', params);
    updateFunds();
  });
  
  // get available funds
  function updateFunds() {
    gdax.authedClient.getAccounts((err, status, data) => {
      if (err) console.error('ERROR: getting accounts funds ', err);

      const btc = data.filter((d) => d.currency === 'BTC')
      const usd = data.filter((d) => d.currency === 'USD');

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
      try {
        const order = JSON.parse(res);
        trailingOrder.setOrder(order);
      } catch (error) {
        socket.write(`${error}\r\n`);
      }

      socket.write(`${JSON.stringify(trailingOrder)}\r\n`);

      if (res.match(/close/i)) {
        socket.end('bye!\r\n');
      }
    });

    socket.write('hola\r\n');
    // socket.pipe(socket);
  });

  db.connect((err, dbi) => {
    if(err) console.warn('ERROR connecting to database. ', err);
    console.log(`Connected correctly to server: ${dbi.serverConfig.host}:${dbi.serverConfig.port}/${dbi.databaseName}`);   

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