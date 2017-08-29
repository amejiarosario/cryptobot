const env = process.env.ENV || process.env.NODE_ENV;

let config = {
  gdax: {
    key: process.env.GDAX_KEY,
    b64secret: process.env.GDAX_SECRET,
    passphrase: process.env.GDAX_PASSPHRASE,
    api: process.env.GDAX_API || 'https://api.gdax.com',
    wss: process.env.GDAX_WSS || 'wss://ws-feed.gdax.com'
  },

  db: {
    uri: process.env.MONGODB_URI || process.env.OPENSHIFT_MONGODB_DB_URL || 'mongodb://localhost:27017/localbot2'
  },

  web: {
    port: process.env.PORT || 8000
  },

  socket: {
    port: process.env.NET_PORT || 7777
  },

  amqp: {
    url: process.env.CLOUDAMQP_URL || 'amqp://localhost',
    queue: process.env.AMQP_QUEUE || 'localbot2'
  },

  ticker: {
    providers: process.env.TICKER_PROVIDERS || '{"gdax": ["BTC-USD", "ETH-USD", "LTC-USD"]}',
    modifiers: process.env.TICKER_MODIFIERS || '{"bufferTime": 10000}'
  }
};

// load the env file and overrite params
if(env) {
  try {
    const envConfig = require(`./${env}`);
    Object.assign(config, envConfig);
  } catch (error) {
    console.log(`No env config found for <${env}>, using default.`);
  }
}

module.exports = config;