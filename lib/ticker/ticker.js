const Rx = require('rxjs/Rx');

function ticker(providers) {
  // connect to provider
  providers.forEach((provider) => {
    const {name, productIds, callback} = provider;
    const instance = require('../providers/' + name);
    instance.ticker(callback, productIds);
  });

  // return an Observable that concats all other observables (wss, amqp)
}

module.exports = ticker;