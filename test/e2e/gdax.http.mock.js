const http = require('http');
const https = require('https');
const fs = require('fs');
const debug = require('debug')('crybot:mock:http');


const { accounts } = require('../responses/gdax');

// curl - k https://localhost:7777/accounts
// https://www.akadia.com/services/ssh_test_certificate.html
var options = {
  key: fs.readFileSync('/Users/admejiar/scripts/certs/localhost/server.key'),
  cert: fs.readFileSync('/Users/admejiar/scripts/certs/localhost/server.crt'),
  requestCert: false,
  rejectUnauthorized: false
};

class GdaxHttpMock {
  constructor({port = 7777} = {}) {
    this.promise = new Promise(resolve => {
      this.server = https.createServer(options, (request, response) => {
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
      }).listen(port, () => {
        debug(`HTTP listening on ${port}`);
        resolve(port);
      });
    });
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