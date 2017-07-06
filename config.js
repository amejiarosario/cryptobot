module.exports = {
  gdax: {
    key: process.env.GDAX_KEY,
    b64secret: process.env.GDAX_SECRET,
    passphrase: process.env.GDAX_PASSPHRASE,
    api: process.env.GDAX_API || 'https://api.gdax.com'
  },

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '27017',
    name: process.env.DB_NAME || 'localbot2',
  }
}