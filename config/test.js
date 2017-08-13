let config = {
  gdax: {
    // api: process.env.GDAX_API || 'http://localhost:5000',
    // wss: process.env.GDAX_WSS || `ws://localhost:7171`
    api: process.env.GDAX_API || 'https://api-public.sandbox.gdax.com',
    wss: process.env.GDAX_WSS || 'wss://ws-feed-public.sandbox.gdax.com'
  },

  db: {
    uri: process.env.MONGODB_URI || process.env.OPENSHIFT_MONGODB_DB_URL || 'mongodb://localhost:27017/localbottest'
  }
};

module.exports = config;