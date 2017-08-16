const Http = require('../e2e/gdax.http.mock');
const http = new Http();

http.isConnected().then(port => {
  console.log('connected from promise', port);
})