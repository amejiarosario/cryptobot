const Gdax = require('gdax');

const config = require('../../config');

const authedClient = new Gdax.AuthenticatedClient(
  config.gdax.key, 
  config.gdax.b64secret, 
  config.gdax.passphrase, 
  config.gdax.api
);

function ticker(callback, products = ['BTC-USD']) {
  const websocket = new Gdax.WebsocketClient(products, { websocketURI: config.gdax.wss});
  
  websocket.on('open', () => console.info(`Listening for ${products.join(', ')} on GDAX`));
  websocket.on('message', callback);
  websocket.on('error', (e) => console.warn('ERROR websocket: ', e));
  websocket.on('close', () => {
    console.warn(`Stopped listening for ${products.join(', ')} on GDAX`);
    console.info(`Retrying connection ${products} in 10s`);
    setTimeout(() => ticker(callback, products), 10e3);
  });
}

/**
 * Cancel all orders or the ones with the given id
 * @param {*} callback callback
 * @param {*} orderID [optional] order id
 */
function cancelOrders(callback, orderID) {
  if (orderID && orderID !== true) {
    authedClient.cancelOrder(orderID, callback);
  } else {
    authedClient.cancelAllOrders({ product_id: 'BTC-USD' }, callback);
  }
}

function getOrders(callback) {
  return authedClient.getOrders(callback);
}

/**
 * See https://docs.gdax.com/#place-a-new-order
 * @param {*} params sell params
 * @property {String} params.type [optional] limit, market, or stop (default is limit)
 * - type	[optional] limit, market, or stop (default is limit)
   - side	buy or sell
   - product_id	A valid product id
   - stp	[optional] Self-trade prevention flag
   - price	Price per bitcoin
   - size	Amount of BTC to buy or sell
   - time_in_force	[optional] GTC, GTT, IOC, or FOK (default is GTC)
   - cancel_after	[optional]* min, hour, day
   - post_only	[optional]** Post only flag
 */
function setOrder(params, callback) {
  params.product_id = params.product_id || 'BTC-USD';

  console.log('setOrder', params);
  if(params.side === 'buy') {
    return authedClient.buy(params, callback);
  } else if (params.side === 'sell') {
    return authedClient.sell(params, callback);
  } else {
    console.warn(`Invalid order side ${params.side}`);
  }
}

module.exports = {
  authedClient,
  ticker,
  getOrders,
  setOrder,
  cancelOrders
};