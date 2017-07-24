let config = {
  gdax: {
    api: process.env.GDAX_API || 'http://localhost:5000',
    wss: process.env.GDAX_WSS || 'ws://localhost:8080'
  },

  db: {
    uri: process.env.MONGODB_URI || process.env.OPENSHIFT_MONGODB_DB_URL || 'mongodb://localhost:27017/localbottest'
  }
};

module.exports = config;