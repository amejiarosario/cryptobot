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
  return Observable.create(observer => {
    const { resolution, multiplier } = getResolutionTuple(multiplierResolution)
    // connect to database
    let last = {};
    const params = { tickerId, resolution, multiplier, limit };

    // get all data initially
    onInterval(params, last).then(data => {
      observer.next(data);
      if(data.length > 0) {
        last = data[data.length - 1]; // the most recent is the last one
      }
    }).catch(error => {
      console.error(error.stack);
    });

    // get ticks based on resolution and limit
    const timer = setInterval(() => {
      onInterval(params, last).then(data => {
        const newData = getOnlyNewData(data, last);

        if(newData.length > 0) {
          observer.next(newData);
          if (newData.length > 0) {
            last = newData[newData.length - 1]; // the most recent is the last one
          }
        }
      }).catch(error => {
        console.error(error.stack);
      });
    }, interval);

    return () => {
      // unsubscribe
      clearInterval(timer);
      debug('Stopping security timer 💣');
    };
  })
}

function onInterval({ tickerId, resolution, multiplier, limit }, last) {
  return mongo.getOhlc({tickerId, resolution, multiplier, limit}).then(dataArray => {
    // debug('ohlc', data);
    const newData = getOnlyNewData(dataArray, last); // FIXME: sending all for now
    return newData;
  }).catch(error => {
    console.error(error.stack);
  });
}

/**
 * the last data is going to change with every tick. Maybe send n - 1
 * @param {*} data
 */
function getOnlyNewData(data, last = {}) {
  const lastIndex = data.findIndex(d => d._id === last._id);
  // debug({data, last, lastIndex})
  if(lastIndex > -1) {
    return data.slice(lastIndex, data.length - lastIndex);
  } else {
    return data;
  }
}

function getResolutionTuple(resolution) {
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

module.exports = security;