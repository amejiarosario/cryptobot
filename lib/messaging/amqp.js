const amqp = require('amqplib');
const uuid = require('node-uuid');
const debug = require('debug')('crybot:amqp');
const Rx = require('rxjs/Rx');

const { url, queue: queueName } = require('../../config').amqp;

/**
 * see https://github.com/squaremo/amqp.node/tree/master/examples/tutorials#tutorial-six-rpc
 * @param {Function} callback takes as parameter the client message and the return will be the response
 */
function server(callback) {
  return amqp.connect(url).then(function (conn) {
    process.once('SIGINT', function () { conn.close(); });

    return conn.createChannel().then(function (ch) {
      var ok = ch.assertQueue(queueName, { durable: false });
      var ok = ok.then(function () {
        ch.prefetch(1);
        return ch.consume(queueName, reply);
      });
      return ok.then(function () {
        debug('Awaiting RPC (AMQP) requests');
      });

      function reply(msg) {
        debug(`Server msg: ${msg.content}`);
        var response = callback(msg.content.toString());
        ch.sendToQueue(msg.properties.replyTo,
          Buffer.from(response.toString()),
          { correlationId: msg.properties.correlationId });
        ch.ack(msg);
      }
    });
  }).catch((err) => {
    console.error(`ERROR: connecting to amqp ${url}`);
    console.error(err);
  });
}

/**
 * Send message to queue and wait for response
 * @param {String} message message to send to the queue/server
 * @param {Function} callback function with error, response from server
 */
function client(message, callback = ()=>{}) {
  return amqp.connect(url).then(function (conn) {
    return conn.createChannel().then(function (ch) {
      return new Promise(function (resolve) {
        var corrId = uuid();
        function maybeAnswer(msg) {
          if (msg.properties.correlationId === corrId) {
            resolve(msg.content.toString());
          }
        }

        var ok = ch.assertQueue('', { exclusive: true })
          .then(function (qok) { return qok.queue; });

        ok = ok.then(function (queue) {
          return ch.consume(queue, maybeAnswer, { noAck: true })
            .then(function () { return queue; });
        });

        ok = ok.then(function (queue) {
          debug('Requesting ', message);
          ch.sendToQueue(queueName, Buffer.from(message), {
            correlationId: corrId, replyTo: queue
          });
        });
      });
    }).then((data) => callback(null, data))
    .finally(function () { conn.close(); });
  }).catch(callback);
}

function serverObservable(processor = JSON.parse) {
  let observable = Rx.Observable.create(observer => {
    server(message => {
      try {
        const processedMessage = processor(message);
        observer.next(processedMessage);
        return processedMessage;
      } catch (error) {
        console.error(error);
        observer.error(error);
        return error;
      }
    });
  });
  return observable;
}

module.exports = {
  server,
  client,
  serverObservable
}