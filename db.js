const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;
const c = require('./config');
const url = `mongodb://${c.db.host}:${c.db.port}/${c.db.name}`;
console.log(url);

MongoClient.connect(url, function (err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server");

  db.close();
});

module.exports = {
  connect: (cb) => MongoClient.connect(url, cb),
  MongoClient
};