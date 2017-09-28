const env = process.env.ENV || process.env.NODE_ENV;

let config = {
  gdax: {
    key: process.env.GDAX_SANDBOX_KEY,
    b64secret: process.env.GDAX_SANDBOX_SECRET,
    passphrase: process.env.GDAX_SANDBOX_PASSPHRASE,
    wss: process.env.GDAX_WSS || 'wss://ws-feed.gdax.com',
    api: process.env.GDAX_API || 'https://api-public.sandbox.gdax.com' // to avoid buying on real server by mistake
  },

  db: {
    uri: process.env.MONGODB_URI || process.env.OPENSHIFT_MONGODB_DB_URL || 'mongodb://localhost:27017/crylocal'
  },

  web: {
    port: process.env.PORT || 8000
  },

  socket: {
    port: process.env.NET_PORT || 7777
  },

  amqp: {
    url: process.env.CLOUDAMQP_URL || 'amqp://localhost',
    rpcQueue: process.env.AMQP_RPC_QUEUE || 'cryRpcQueue',
    simpleQueue: process.env.AMQP_SIMPLE_QUEUE || 'crySimpleQueue'
  },

  ticker: {
    providers: process.env.CRYBOT_TICKER_PROVIDERS || '{"gdax": ["BTC-USD", "ETH-USD", "LTC-USD"]}',
    modifiers: process.env.CRYBOT_TICKER_MODIFIERS || '{"bufferTime": 10000}'
  },

  analyzer: {
    strategy: process.env.CRYBOT_ANALYZER_STRATEGY || 'weekly-close-diff'
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