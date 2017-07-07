const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;
const config = require('./config');

// TODO: delete this function from here
MongoClient.connect(config.db.uri, function (err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server:", config.db.uri);

  db.close();
});

module.exports = {
  connect: (cb) => MongoClient.connect(config.db.uri, cb),
  MongoClient
};