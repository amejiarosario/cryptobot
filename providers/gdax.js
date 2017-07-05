// https://github.com/coinbase/gdax-node

const config = require('../config');
const Gdax = require('gdax');

const authedClient = new Gdax.AuthenticatedClient(
  config.gdax.key, 
  config.gdax.b64secret, 
  config.gdax.passphrase, 
  config.gdax.api
);

function onMatches(callback, products = ['BTC-USD']) {
  const websocket = new Gdax.WebsocketClient(products);

  websocket.on('message', function (d) {
    if (d.type === 'match') {
      callback(`${d.product_id} ${d.time}: ${d.price} ${d.size} (${d.type})`);
    }
  });  
}

module.exports = {
  authedClient,
  onMatches
};