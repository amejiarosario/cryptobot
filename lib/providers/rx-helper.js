const Rx = require('rxjs/Rx');
const Observable = Rx.Observable;

function webSocketFromEventsToObservable(websocket) {
  process.once('SIGINT', function () { websocket.close(); });

  const open = Observable.fromEvent(websocket, 'open');
  const error = Observable.fromEvent(websocket, 'error').mergeMap(Observable.throw);
  const close = Observable.fromEvent(websocket, 'close');
  const message = Observable.fromEvent(websocket, 'message');

  const datastream = message
    .merge(error)
    .skipUntil(open.race(error))
    .takeUntil(close.race(error));

  return datastream;
}

module.exports = {
  webSocketFromEventsToObservable
}