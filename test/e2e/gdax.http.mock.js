const http = require('http');
const https = require('https');
const { accounts } = require('../responses/gdax');
var fs = require('fs');

// curl - k https://localhost:7777/accounts
// https://www.akadia.com/services/ssh_test_certificate.html
var options = {
  key: fs.readFileSync('/Users/admejiar/scripts/certs/server.key'),
  cert: fs.readFileSync('/Users/admejiar/scripts/certs/server.crt'),
  requestCert: false,
  rejectUnauthorized: false
};

class GdaxHttpMock {
  constructor({port = 7777} = {}) {
    this.promise = new Promise(resolve => {
      this.server = https.createServer(options, (request, response) => {
      // this.server = http.createServer((request, response) => {
        console.log('request', request.method, request.url);

        const hasMatch = [
          this.getAccount(request, response),
          this.getEcho(request, response)
        ].some(i => i);

        if (!hasMatch) {
          response.statusCode = 404;
          response.end();
        }
      }).listen(port, () => {
        console.log(`HTTP listening on ${port}`);
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