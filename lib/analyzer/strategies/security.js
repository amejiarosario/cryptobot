const { Observable } = require('rxjs');
const debug = require('debug')('crybot:security');

const mongo = require('../../ticker/db');

function security(tickerId, multiplierResolution, limit, interval) {
  return Observable.create(observer => {
    const { resolution, multiplier } = getResolutionTuple(multiplierResolution)
    // connect to database
    let last = null;
    const params = { tickerId, resolution, multiplier, limit };

    // get all data initially
    onInterval(params).then(data => {
      observer.next(data);
      last = data[0]; // the most recent is at the very top
    }).catch(error => {
      console.error(error.stack);
    });

    // get ticks based on resolution and limit
    const timer = setInterval(() => {
      onInterval(params).then(data => {
        const newData = getOnlyNewData(data, last);
        if(newData.length > 0) {
          observer.next(newData);
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

function onInterval({ tickerId, resolution, multiplier, limit}) {
  return mongo.getOhlc({tickerId, resolution, multiplier, limit}).then(data => {
    // debug('ohlc', data);
    const newData = getOnlyNewData(data); // FIXME: sending all for now
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
  return data.slice(0, lastIndex < 0 ? data.length : lastIndex);
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