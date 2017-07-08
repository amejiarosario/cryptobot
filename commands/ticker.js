const chalk = require('chalk');

const gdax = require('./gdax');
const db = require('../db');
const netcli = require('./socket-cli');
const program = require('commander');

function ticker(options) {
  let last, sequence, limits = {}, color = chalk.yellow;

  function checkPrice(current) {
    const alert = `Alert: Price ${current} within limits`;

    if (limits.lte && limits.gte && current <= parseFloat(limits.lte) && current >= parseFloat(limits.gte) ||
      limits.lte && current <= parseFloat(limits.lte) ||
      limits.gte && current >= parseFloat(limits.gte)) {
      console.log(chalk.bgBlue(chalk.white(alert)));
      limits = {};
    }
  }

  // telnet localhost 7777 | {"lte": 2520, "gte": 2521}
  netcli.server((socket) => {
    socket.setEncoding('utf-8');

    // 'connection' listener
    socket.on('end', () => {
      console.log('client disconnected');
    });

    socket.on('data', (res) => {
      try {
        var test = JSON.parse(res);
        if(!test.lte && !test.gte) throw new Error('You have to specify lte or gte');
        limits = test;
      } catch (error) {
        socket.write(`${error}\r\n`);
      }

      console.log(res, limits);
      socket.write(`${JSON.stringify(limits)}\r\n`);

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

        console.log(`${data.time} (${data.type}): ${data.side} \t ${data.product_id} ${data.size} @ ${data.price} \t ${color(diff)} ${color(change)}% \t ${JSON.stringify(limits)}`);

        checkPrice(current, limits)

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