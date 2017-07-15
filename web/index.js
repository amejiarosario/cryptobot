const morgan = require('morgan');
const express = require('express');
const bodyParser = require('body-parser');

const port = require('../config').web.port;
const app = express();

const netcli = require('../commands/socket-cli');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(morgan('dev')) // login

app.get('/', (req, res) => {
  res.json({hello: 'world'});
});

app.get('/orders', function (req, res) {
  // res.json({});
  netcli.client('order', (err, data) => {
    if(err) console.error("ERROR: failed getting orders", err);
    console.log('app.get.data:', data);
    res.json(data);
  });
});

app.post('/orders', (req, res) => {
  netcli.client(JSON.stringify(req.body), (err, data) => {
    res.json(err || data);
  });  
});

app.listen(port, function () {
  console.log(`HTTP server on port ${port}`);
});