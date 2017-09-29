const env = 'simulation';
let config = {
  gdax: {
    wss: process.env.GDAX_WSS || `ws://localhost:7771`,
    api: process.env.GDAX_API || 'https://localhost:7777'
  },

  db: {
    uri: process.env.MONGODB_URI || process.env.OPENSHIFT_MONGODB_DB_URL || `mongodb://localhost:27017/crylocal-${env}`
  },

  amqp: {
    rpcQueue: process.env.AMQP_RPC_QUEUE || `cryRpcQueue-${env}`,
    simpleQueue: process.env.AMQP_SIMPLE_QUEUE || `crySimpleQueue-${env}`
  }
};

module.exports = config;