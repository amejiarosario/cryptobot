const gdax = require('../providers/gdax');

function ticker(options) {
  gdax.onMatches((t) => console.log(t));
}

module.exports = ticker;