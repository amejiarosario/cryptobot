/** A really, really, really fake websocket */
class FakeWebSocket {
  constructor(url) {
    this.url = url;
    // console.log('connecting to ' + url);
    this.open();
    this.start();
    // console.log('FakeWebSocket::constructor');
  }

  start() {
    let i = 0;
    this.id = setInterval(() => this.triggerEvent('message', ++i), 10);
  }

  open() {
    this.triggerEvent('open', 'opened');
  }

  close() {
    // console.log('closing connection to ' + this.url);
    clearInterval(this.id);
  }

  disconnect() {
    this.close();
  }

  addEventListener(name, handler) {
    const listeners = this.listeners = this.listeners || {};
    const handlers = listeners[name] = listeners[name] || [];
    handlers.push(handler);
  }

  removeEventListener(name) {
    // throw new Error('No implemented');
  }

  off(name) {
    this.removeEventListener(name);
  }

  on(name, handler) {
    this.addEventListener(name, handler);
  }

  triggerEvent(type, msg) {
    // console.log('t', msg);

    const listeners = this.listeners;
    if (listeners) {
      const handlers = listeners[type];
      handlers.forEach(handler => handler({
        // target: this,
        type: 'match', // received
        order_id: '154556c9-c46b-4b3f-939c-5083a286fa41',
        order_type: 'limit',
        size: '0.20000000',
        price: msg,
        side: 'sell',
        client_oid: '9db15138-8f44-4a46-8195-d59a8b38de46',
        product_id: 'BTC-USD',
        sequence: 3864946233,
        time: '2017-08-19T13:30:02.657000Z'
      }));
    }
  }
}

module.exports = FakeWebSocket;