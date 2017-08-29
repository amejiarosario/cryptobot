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
  mongo.connect((error, db) => {
    if (error) {
      return res.status(500).json({ error: error });
    }
    const collection = db.collection('orders');
    collection.find({ status: 'open' }).toArray((error, docs) => {
      if(error) {
        res.status(500).json({ error: error});
      } else {
        res.json(docs);
      }
    });
  });
});

app.post('/orders', (req, res) => {
  const body = JSON.stringify(req.body);
  amqp.client(body, (err, data) => {
    if(err) {
      debug('Error:', err);
      res.status(500).json({ error: err });
    } else {
      res.json(JSON.parse(data));
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