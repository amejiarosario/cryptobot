const Rx = require('rxjs/Rx');
const Observable = Rx.Observable;
const debug = require('debug')('crybot:rx-helper');

function webSocketFromEventsToObservable(websocket) {
  return new Observable(observer => {
    // websocket.on('open', e => observer.next(e));
    websocket.on('message', e => observer.next(e));
    websocket.on('error', e => observer.error(e));
    websocket.on('close', e => observer.complete(e));

    return () => {
      debug(`Disconecting from websocket...`);
      websocket.disconnect();
    }
  });
}

module.exports = {
  webSocketFromEventsToObservable
}