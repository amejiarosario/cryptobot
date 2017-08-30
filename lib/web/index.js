const morgan = require('morgan');
const express = require('express');
const bodyParser = require('body-parser');
const debug = require('debug')('crybot:web');

const mongo = require('../ticker/db');
const port = require('../../config').web.port;
const amqp = require('../messaging/amqp');

const app = express();
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(morgan('dev')) // login

app.get('/', (req, res) => {
  res.json({hello: 'world'});
});

app.get('/orders', function (req, res) {
  mongo.loadOrders().then(orders => {
    res.json(orders);
  }).catch(error => {
    console.error(error.stack);
    res.status(500).json({ error: error });
  });
});

app.post('/orders', (req, res) => {
  const body = JSON.stringify(req.body);
  amqp.client(body, (err, data) => {
    if(err) {
      debug('Error:', err);
      res.status(500).json({ error: err });
    } else {
      mongo.loadOrders().then(orders => {
        res.json(orders);
      }).catch(error => {
        console.error(error.stack);
        res.json(JSON.stringify(data));
      });
    }
  });
});

const server = app.listen(port, function () {
  console.log(`HTTP server on port ${port}`);
});

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

function shutdown() {
  debug('graceful shutdown express');
  server.close(function () {
    debug('closed express');
  });
}