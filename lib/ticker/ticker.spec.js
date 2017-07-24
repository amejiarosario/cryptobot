const sinon = require('sinon');
const { expect, assert } = require('chai');
const { Server } = require('mock-socket');
const WebSocket = require('ws');

const ticker = require('./ticker');
const gdax = require('../providers/gdax');
const config = require('../../config');

describe('Ticker', function () {
  this.timeout(500);

  describe('Provider market ticks', () => {
    it('should call the ticker function on the provider', () => {
      sinon.stub(gdax, 'ticker');

      const providers = [{
        get: gdax,
        productIds: ['BTC-USD'],
        callback: sinon.spy()
      }];

      ticker(providers);
      expect(gdax.ticker.called);

      gdax.ticker.restore();
    });

    it('[non-mocked WSS] should subscribe for tick events from GDAX for BTC-USD', (done) => {
      const tick = { "type": "match", "trade_id": 18558088, "maker_order_id": "e6c45036-f52c-4745-bdaa-ac5a9d5f9afb", "taker_order_id": "48782454-8edd-4af3-b345-f9e1a6609735", "side": "buy", "size": "0.11504113", "price": "2760.55000000", "product_id": "BTC-USD", "sequence": 3679728703, "time": "2017-07-24T20:38:09.391000Z" };
      const wss = new WebSocket.Server({ port: 8080 });

      wss.on('connection', function connection(ws) {
        ws.on('message', function incoming(message) {
          expect(message).to.eql(JSON.stringify({ "type": "subscribe", "product_ids": ["BTC-USD"] }));
          ws.send(JSON.stringify(tick));
        });
      });

      function callback(data) {
        expect(data).to.eql(tick);
        wss.close(done);
      }

      const providers = [{
        get: gdax,
        productIds: ['BTC-USD'],
        callback: callback
      }];

      ticker(providers);
    });
  });
  describe('Listen for orders', () => { });
  describe('Execute orders on Provider', () => { });
  describe('Save data', () => { });
  describe('Working with multiple pairs BTC/USD, ETH/USD, LTC/USD', () => { });
  describe('Working with multiple provides GDAX, Poloniex', () => { });

  it('should remove/repurpose the index.js file')
});