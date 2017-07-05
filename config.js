module.exports = {
  gdax: {
    key: process.env.GDAX_KEY,
    b64secret: process.env.GDAX_SECRET,
    passphrase: process.env.GDAX_PASSPHRASE,
    api: process.env.GDAX_API || 'https://api.gdax.com'
  }
}