const sinon = require('sinon');
const { expect, assert } = require('chai');
// const { Server } = require('mock-socket');
const WebSocket = require('ws');
const { Observable } = require('rxjs/Rx');

describe('Ticker', function () {
  describe('Provider market ticks', () => {
    // http://reactivex.io/rxjs/test-file/spec-js/observables/dom/webSocket-spec.js.html#lineNumber306
    // http://reactivex.io/rxjs/file/es6/observable/dom/WebSocketSubject.js.html#lineNumber92
    xit('[non-mocked WSS] should subscribe for tick events from GDAX for BTC-USD and ETH-USD and only get matches', (done) => {
      sinon.stub(amqp, 'serverObservable').returns(Observable.never());

      const tick1 = { "type": "match", "trade_id": 18558088, "maker_order_id": "e6c45036-f52c-4745-bdaa-ac5a9d5f9afb", "taker_order_id": "48782454-8edd-4af3-b345-f9e1a6609735", "side": "buy", "size": "0.11504113", "price": "2760.55000000", "product_id": "BTC-USD", "sequence": 3679728703, "time": "2017-07-24T20:38:09.391000Z" };
      const tick2 = { type: 'match', trade_id: 8336467, maker_order_id: '4dce3ad5-f476-466a-90a0-439efc37913f', taker_order_id: 'd2237096-90c4-4c46-9309-aed0a2c6e85d', side: 'sell', size: '0.91299383', price: '210.32000000', product_id: 'ETH-USD', sequence: 856195659, time: '2017-07-25T10:46:06.270000Z' };
      const tick3 = { type: 'open', side: 'sell', price: '207.56000000', order_id: '4ca464fa-820d-44bd-9f2b-c6ed148074a8', remaining_size: '2.00000000', product_id: 'ETH-USD', sequence: 856312457, time: '2017-07-25T11:00:44.743000Z' };

      const wss = new WebSocket.Server({ port: 7171 });
      wss.on('connection', function connection(ws) {
        ws.on('message', function incoming(message) {
          expect(message).to.equal(JSON.stringify({ "type": "subscribe", "product_ids": ["BTC-USD", "ETH-USD"] }));
          ws.send(JSON.stringify(tick1));
          ws.send(JSON.stringify(tick3));
          ws.send(JSON.stringify(tick2));
        });
      });

      const providers = [{
        name: 'gdax',
        productIds: ['BTC-USD', 'ETH-USD']
      }];

      const observable = ticker(providers);
      observable.subscribe(
        data => {
          if (data.product_id === 'BTC-USD') {
            expect(data).to.eql(tick1);
          } else {
            expect(data).to.eql(tick2);
            wss.close();
            amqp.serverObservable.restore();
            done()
          }
          if (data.type === 'open') {
            wss.close();
            done(new Error('open orders should not be here'));
          }
        },
        error => done(new Error(error))
      )
    });
  });

  describe('Listen for orders', () => {
    xit('[non-mocked AMQP] should add order events into the observable', done => {
      sinon.stub(gdax, 'tickerObservable').returns(Observable.never());

      const providers = [{
        name: 'gdax',
        productIds: ['BTC-USD']
      }];

      const orders = [
        { provider: 'gdax.BTC-USD', order: { "side": "buy", "target": 2046, "trailing": { "amount": 50, "percentage": 0.5 }, trade: { "percentage": 0.5, "amount": 900 } } },
        { "side": "sell", "target": 2046, "trailing": { "amount": 50 }, trade: { "percentage": 0.5, "amount": 900 } }
      ];

      const observable = ticker(providers);
      observable.subscribe(
        data => {
          expect(data).to.eql(orders);
          gdax.tickerObservable.restore();
          done();
        },
        error => done(new Error(error))
      );

      setTimeout(() => {
        amqp.client(JSON.stringify(orders));
      }, 10);
    });
  });
});