// const {Observable} = require('rxjs/Observable');
// patch Observable with appropriate methods
// require('rxjs/add/observable/of');
// require('rxjs/add/operator/map');
// require('rxjs/add/observable/dom/webSocket')

const Rx = require('rxjs/Rx');
const Observable = Rx.Observable;

// Observable.of(1, 2, 3).map(function (x) { return x + '!!!'; }); // etc

// https://github.com/ReactiveX/rxjs/blob/master/src/observable/dom/WebSocketSubject.ts#L63
const { w3cwebsocket } = require('websocket');

const subject = Observable.webSocket({
  url: 'wss://ws-feed.gdax.com',
  WebSocketCtor: w3cwebsocket
});

const subscription = subject
  .filter((msg) => msg.type === 'match')
  .subscribe(
    (msg) => console.log('message received: ' + JSON.stringify(msg)),
    (err) => console.log(err),
    () => console.log('complete')
  );

subject.next(JSON.stringify({
  type: 'subscribe',
  product_ids: [
    'BTC-USD'
  ]
}));

subject.next(JSON.stringify({
  "type": "heartbeat",
  "on": true
}));

setTimeout(() => {
  console.log('-----------------')
  subscription.unsubscribe();
  console.log('-----------------')
}, 10e3);