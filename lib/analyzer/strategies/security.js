const { Observable } = require('rxjs');
const debug = require('debug')('crybot:security');

const mongo = require('../../ticker/db');

/**
 * Returns Observable with only NEW [data] every given interval
 * FIXME: sending all data
 *
 * @param {*} tickerId
 * @param {*} multiplierResolution
 * @param {*} limit
 * @param {*} interval
 */
function security(tickerId, multiplierResolution, limit, interval) {
  debug('Subscribing to security %o', { tickerId, multiplierResolution, limit, interval});
  return Observable.create(observer => {
    const { resolution, multiplier } = getResolutionTuple(multiplierResolution)
    // connect to database
    let last = {};
    const params = { tickerId, resolution, multiplier, limit };

    // get all data initially
    sendLastTicks(params, last, observer);

    // get ticks based on resolution and limit
    const timer = setInterval(() => {
      sendLastTicks(params, last, observer);
    }, interval);

    return () => {
      // unsubscribe
      clearInterval(timer);
      debug('Stopping security timer 💣');
    };
  })
}

function sendLastTicks({ tickerId, resolution, multiplier, limit }, last, observer) {
  return mongo.getOhlc({tickerId, resolution, multiplier, limit}).then(dataArray => {
    // debug('ohlc', dataArray);
    const newData = getOnlyNewData(dataArray, last); // FIXME: sending all for now
    if(newData.length > 0) {
      observer.next(newData);
      last._id = newData[newData.length -1]._id.toString();
    }
    return newData;
  }).catch(error => {
    console.error(error.stack);
    observer.error(error);
  });
}

/**
 * the last data is going to change with every tick. Maybe send n - 1
 * @param {*} data
 */
function getOnlyNewData(data, last) {
  const lastIndex = data.findIndex(d => d._id.toString() === last._id);
  debug('------------ %o ------------', { data: data.map(t => t._id), last, lastIndex, slice: { s: (lastIndex + 1), e: (data.length)/*, data: data.slice(lastIndex + 1, data.length) */}});
  if(lastIndex > -1) {
    return data.slice(lastIndex + 1, data.length);
  } else {
    return data;
  }
}

function getResolutionTuple(resolution = '') {
  const map = {
    m: 'minutes',
    h: 'hours',
    d: 'days',
    w: 'weeks',
    mo: 'months'
  };

  const [time] = /[A-Za-z]+/.exec(resolution.toLowerCase());

  return {
    multiplier: parseInt(resolution) || 1,
    resolution: map[time]
  }
}

module.exports = {security};