let config = {
  gdax: {
    key: process.env.GDAX_SANDBOX_KEY,
    b64secret: process.env.GDAX_SANDBOX_SECRET,
    passphrase: process.env.GDAX_SANDBOX_PASSPHRASE,
    wss: process.env.GDAX_WSS || `ws://localhost:7771`,
    // wss: process.env.GDAX_WSS || 'wss://ws-feed-public.sandbox.gdax.com'
    // api: process.env.GDAX_API || 'http://localhost:7777',
    api: process.env.GDAX_API || 'https://api-public.sandbox.gdax.com'
  },

  db: {
    uri: process.env.MONGODB_URI || process.env.OPENSHIFT_MONGODB_DB_URL || 'mongodb://localhost:27017/crylocal-test'
  },

  amqp: {
    url: process.env.CLOUDAMQP_URL || 'amqp://localhost',
    queue: process.env.AMQP_QUEUE || 'cryqueue-test'
  },
};

module.exports = config;