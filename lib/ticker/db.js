const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;
const debug = require('debug')('db');

const config = require('../../config');

module.exports = {
  connect: (cb) => {
    debug(`connecting to ${config.db.uri}`);
    return MongoClient.connect(config.db.uri, cb);
  },
  MongoClient
};