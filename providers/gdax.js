// https://github.com/coinbase/gdax-node

const config = require('../config');
const Gdax = require('gdax');

const authedClient = new Gdax.AuthenticatedClient(
  config.gdax.key, 
  config.gdax.b64secret, 
  config.gdax.passphrase, 
  config.gdax.api
);

function ticker(callback, products = ['BTC-USD']) {
  const websocket = new Gdax.WebsocketClient(products);
  websocket.on('open', () => console.info(`Listening for ${products.join(', ')} on GDAX`));
  websocket.on('message', callback);
  websocket.on('error', (e) => console.error('ERROR websocket: ', e));
  websocket.on('close', () => {
    console.warn(`Stopped listening for ${products.join(', ')} on GDAX`);
    console.info(`Retrying connection ${products} in 10s`);
    setTimeout(() => ticker(callback, products), 10e3);
  });
}

function getOrders(callback) {
  authedClient.getOrders((err, res, data) => callback(data));  
}

module.exports = {
  authedClient,
  ticker,
  getOrders
};