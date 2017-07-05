const gdax = require('../providers/gdax');

function orders(options) {
  gdax.getOrders((t) => console.log(t));
}

module.exports = orders;