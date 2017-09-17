const { Observable } = require('rxjs');
const mongo = require('../../ticker/db');

function security(tickerId, resolution, period) {
  return Observable.create(observer => {
    // connect to database
    // get ticks based on resolution and period
    return () => {
      // unsubscribe
    };
  })
}

module.exports = security;