const WebSocket = require('ws');
const uuid = require('uuid');
const debug = require('debug')('crybot:mock:wss');
const { MongoClient } = require('mongodb');
const CONFIG = require('../../config');
const moment = require('moment');
const Ohlc = require('../../lib/common/ohlc-aggregator');

class GdaxWebsocketMock {
  constructor({ port = 7771, collection = {} } = {}) {
    this.collection = collection;
    this.isBusy = false;

    this.promise = new Promise((resolve) => {
      this.wss = new WebSocket.Server({ port });
      debug(`WSS on port ${port} ${JSON.stringify(collection.name)}`);
      resolve(port);

      this.wss.on('connection', (ws) => {
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

      if (message.type === 'subscribe' && !this.isBusy) {
        // this.generateFakeMarketTicks(ws, message.product_ids);
        // this.replayMarcketTicks(ws);
        this.sendTicks(ws);
      }
    };
  }

  sendTicks(ws) {
    this._ws = ws;
    if(this.collection.name) {
      this.replayFromCollection(this.collection.dateFormat).then(messages => {
        debug(`Done getting messages!`, messages.length);
        return this.sendMessages(ws, messages, this.collection.delay);
      }).then(() => {
        debug(`Done sending messages!!!`);
      }).catch(error => { throw new Error(error); });
    } else {
      this.reset(); // send replay from file
    }
  }

  async sendMessages(ws, messages, delay = 0){
    return new Promise(resolve => {
      let index = 0;
      const t = setInterval(() => {
        if(index >= messages.length) {
          clearInterval(t);
          resolve();
        } else {
          const tick = messages[index++];
          debug('>>> tick:         $%d     ---     %s', tick.price, tick.time);
          ws.send(getTickString(tick), error => {
            if (error) throw new Error(error);
          });
        }

      }, delay);
    });
  }

  /**
   * Sending each individual tick is not feasible since it's too much data and for large range CPU goes crazy
   * Sending a OHLC snapshot by time can solve this problem (e.g. by hour).
   *
   * Full format 'YYYY-MM-DD HH:mm:ss.SSS'
   * by Hour format 'YYYY-MM-DD HH:00:00.000'
   * by Day format 'YYYY-MM-DD 00:00:00.000'
   *
   * @param {*} ws
   */
  async replayFromCollection(dateFormat = 'YYYY-MM-DD HH:00:00.000') {
    this.isBusy = true;
    debug(`Connecting to ${CONFIG.db.backup} -- ${this.collection.name} -- ${dateFormat}...`);

    const db = await MongoClient.connect(CONFIG.db.backup);
    const collection = db.collection(this.collection.name);
    const cursor = collection.aggregate(this.collection.pipeline, { allowDiskUse: true });

    return new Promise(resolve => {
      const map = {};
      let lastTime = null;
      let totalSent = 0;
      let messages = [];
      let ohlc = new Ohlc({ format: dateFormat, cb: ticks => {
        messages = messages.concat(ticks);
        totalSent++;
      }});

      cursor.forEach(doc => {
        const tick = doc.ticks;
        ohlc.update(tick);
      }, error => {
        if (error) {
          debug(`Error iterating collection ${error}`);
          debug(`*** Total messages sent: ${totalSent}`);
          throw new Error(error);
        } else {
          // done
          debug(`--- Total messages sent: ${totalSent}`);
          this.isBusy = false;
          db.close();
          ohlc.flush(ticks => {
            messages = messages.concat(ticks);
            resolve(messages);
          });
        }
      });
    });
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

    this.isBusy = true;
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
        this.isBusy = false;
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
    debug(`closing wss...`)
    this.wss.close();
    if(this.t) {
      clearInterval(this.t);
      debug(`cleared wss interval`);
    }
  }
}

function getTickString(tick) {
  return JSON.stringify({
    "type": "match",
    "trade_id": tick._id,
    "maker_order_id": 1,
    "taker_order_id": 2,
    "side": tick.side,
    "size": tick.size,
    "price": parseFloat(tick.price),
    "product_id": 'BTC-USD',
    "sequence": tick._id,
    "time": tick.time
  });
}

module.exports = GdaxWebsocketMock;