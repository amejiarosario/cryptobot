const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;

const config = require('../../config');

module.exports = {
  connect: (cb) => MongoClient.connect(config.db.uri, cb),
  MongoClient
};