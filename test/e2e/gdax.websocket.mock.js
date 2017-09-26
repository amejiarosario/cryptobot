const WebSocket = require('ws');
const uuid = require('uuid');
const debug = require('debug')('crybot:mock:wss');

class GdaxWebsocketMock {
  constructor({ port = 7771 } = {}) {
    this.promise = new Promise((resolve) => {
      this.wss = new WebSocket.Server({ port });
      debug('WSS on port', port);
      resolve(port);

      this.wss.on('connection', (ws) => {
        this._ws = ws;
        ws.on('message', this.onMessage(ws));
        ws.on('close', () => {
          if (this.t) { clearInterval(this.t); }
          this._ws = null;
        });
      });
    });
  }

  isConnected() {
    return this.promise;
  }

  onMessage(ws) {
    return message => {
      message = JSON.parse(message);
      debug(`got message: %o`, message);

      if (message.type === 'subscribe') {
        // this.generateFakeMarketTicks(ws, message.product_ids);
        this.replayMarcketTicks(ws);
      }
    };
  }

  reset() {
    if(this._ws) {
      if(this.t) clearInterval(this.t);
      this.replayMarcketTicks(this._ws);
    }
  }

  replayMarcketTicks(ws) {
    const ticks = require('../responses/gdax.ticks');
    let seq = 0;

    this.t = setInterval(() => {
      const data = (Object.assign({
        sequence: seq,
        product_id: 'BTC-USD',
        type: 'match'
      }, ticks[seq++]));
      // console.log('data.tick', data);

      ws.send(JSON.stringify(data));

      if(seq === ticks.length - 1) {
        clearInterval(this.t);
      }
    }, 5);
  }

  generateFakeMarketTicks(ws, products) {
    let seq = 0;
    let price = 4000;
    const side = ["buy", "sell"];
    const types = ["open", "match"];

    this.t = setInterval(() => {
      // price += (Math.random() * 10 - Math.random() * 7);
      price += (Math.random() * 50 - Math.random() * 40);

      const data = JSON.stringify({
        // "type": types[Math.floor(types.length * Math.random())],
        "type": "match",
        "trade_id": 18558088 + seq,
        "maker_order_id": uuid(),
        "taker_order_id": uuid(),
        "side": side[Math.floor(side.length * Math.random())],
        "size": (Math.random()).toFixed(8),
        "price": price.toFixed(4),
        "product_id": products[Math.floor(products.length * Math.random())],
        "sequence": (++seq),
        "time": new Date().toISOString()
      });
      ws.send(data);

    }, 50);
  }

  close() {
    this.wss.close();
    if(this.t) {
      clearInterval(this.t);
    }
  }
}

module.exports = GdaxWebsocketMock;