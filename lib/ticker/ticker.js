const Rx = require('rxjs/Rx');
const amqp = require('../messaging/amqp');

function ticker(providers) {
  let observable = Rx.Observable.never();

  // connect to providers and concat observables
  providers.forEach((provider) => {
    const {name, productIds} = provider;
    const instance = require('../providers/' + name);
    const tickerObservable = instance.tickerObservable(productIds);
    observable = observable.merge(tickerObservable);
  });

  // listen for amqp messages
  observable = observable.merge(amqp.serverObservable());

  // return an Observable that concats all other observables (wss, amqp)
  return observable;
}

module.exports = ticker;