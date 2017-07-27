const Rx = require('rxjs/Rx');

function ticker(providers) {
  let observable = Rx.Observable.never();

  // connect to providers and concat observables
  providers.forEach((provider) => {
    const {name, productIds} = provider;
    const instance = require('../providers/' + name);
    const tickerObservable = instance.tickerObservable(productIds);
    observable = observable.merge(tickerObservable);
  });

  // return an Observable that concats all other observables (wss, amqp)
  return observable;
}

module.exports = ticker;