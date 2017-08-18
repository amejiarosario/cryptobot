const http = require('http');
const https = require('https');
const fs = require('fs');
const debug = require('debug')('crybot:mock:http');

const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const { accounts } = require('../responses/gdax');

// curl - k https://localhost:7777/accounts
// https://www.akadia.com/services/ssh_test_certificate.html
// to avoid "unable to verify the first certificate" use NODE_TLS_REJECT_UNAUTHORIZED=0
// use NODE_TLS_REJECT_UNAUTHORIZED=0 --- https://github.com/request/request/issues/2061
var options = {
  key: fs.readFileSync('/Users/admejiar/scripts/certs/localhost/server.key'),
  cert: fs.readFileSync('/Users/admejiar/scripts/certs/localhost/server.crt'),
  requestCert: false,
  rejectUnauthorized: false

  // ciphers: 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA:ECDHE-RSA-AES256-SHA384',
  // honorCipherOrder: true,
  // secureProtocol: 'TLSv1_2_method'

  // requestCert: true,
  // rejectUnauthorized: true
};

class GdaxHttpMock {
  constructor({port = 7777} = {}) {
    this.promise = new Promise(resolve => {
      this.app = this.getExpressApp();

      this.server = https.createServer(options, this.app)
      // this.server = https.createServer(options, this.requestHandler)
      .listen(port, () => {
        debug(`HTTP listening on ${port}`);
        resolve(port);
      }).on('close', () => {
        debug('Closing HTTP server');
      });

    });
  }

  getExpressApp() {
    const app = express();
    app.use(bodyParser.json()); // for parsing application/json
    app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
    app.use(morgan('dev')) // login

    app.get('/accounts', (req, res) => {
      res.json(accounts);
    });

    return app;
  }

  requestHandler(request, response) {
    // this.server = http.createServer((request, response) => {
    debug('request', request.method, request.url);

    const hasMatch = [
      this.getAccount(request, response),
      this.getEcho(request, response)
    ].some(i => i);

    if (!hasMatch) {
      response.statusCode = 404;
      response.end();
    }
  }

  isConnected() {
    return this.promise;
  }

  getAccount(request, response) {
    if (request.method === 'GET' && request.url === '/accounts') {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(accounts));
      return true;
    }
  }

  getEcho(request, response) {
    if (request.method === 'GET' && request.url === '/echo') {
      let body = [];
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');

      request.on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();
        response.end(body);
      });
      return true;
    }
  }

  close() {
    this.server.close();
  }
}

module.exports = GdaxHttpMock;