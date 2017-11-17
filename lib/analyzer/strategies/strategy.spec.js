const { expect } = require('chai');
const sinon = require('sinon');

const mongo = require('../../ticker/db');
const amqp = require('../../messaging/amqp');
const { Strategy } = require('./strategy');

const fulfilledOrder = { status: 'done' };
const unfulfillOrder = { status: 'open' };

describe('Strategy', function () {
  this.timeout(100);
  let orderSent;

  beforeEach(() => {
    if (mongo.getLastOrdersByStrategy.restore) mongo.getLastOrdersByStrategy.restore();
    if (amqp.client.restore) amqp.client.restore();
    orderSent = sinon.stub(amqp, 'client').callsFake((d, fn) => {fn()});
  });

  afterEach(() => {
    // orderSent.reset();
  });

  describe('Long', () => {
    it('should make an order if no other order has been made', () => {
      sinon.stub(mongo, 'getLastOrdersByStrategy').resolves([]);
      Strategy.long.entry({});

      setTimeout(() => {
        expect(orderSent.called).to.equal(true);
        // sinon.assert.calledOnce(amqp.client);
      }, 50);
    });

    xit('should not make an entry if there is already an unfulfill exit', () => {
      sinon.stub(mongo, 'getLastOrdersByStrategy').resolves([fulfilledOrder, unfulfillOrder]);

      Strategy.long.entry({});
      setTimeout(() => {
        expect(orderSent.called).to.equal(false);
      }, 50);
    });
  });
});