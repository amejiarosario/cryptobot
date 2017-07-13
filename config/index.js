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
  }
};

// load the env file and overrite params
if(env) {
  Object.assign(config, require(`./${env}`));
}

module.exports = config;