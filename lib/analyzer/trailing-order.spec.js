const sinon = require('sinon');
const expect = require('chai').expect;
const TrailingOrder = require('./trailing-order');

/**
 * Set a trailing buy stop,
 */
describe('Trailing Price', function() {
  this.timeout(100);
  let to;

  beforeEach(() => {
    to = new TrailingOrder();
    // TODO: add to doc all trailing amouts are in dollars
  });

  describe('#sell', () => {
    describe('when trailing is percentage and amount and trade has no amount', () => {
      beforeEach(() => {
        to.setOrder([
          { side: 'sell', target: 1500, trailing: { amount: 50, percentage: 0.01 } }
        ]);
      });

      it('should not set trade values', () => {
        to.setPrice(1000);
        expect(to.orders[0].trigger.sell).to.equal(undefined);
      });

      it('should set trail values', () => {
        to.setPrice(2000);
        expect(to.orders[0].trigger.sell).to.not.equal(undefined);
        expect(to.orders[0].trigger.sell.price).to.equal(1980);
        expect(to.orders[0].trigger.sell.trail).to.equal(2020);
      });

      it('should never reduce the sell price', () => {
        to.setPrice(1501); // activates
        expect(to.orders[0].trigger.sell.price).to.equal(1485.99);
        expect(to.orders[0].trigger.sell.trail).to.equal(1516.01);

        to.setPrice(1486); // should not change since price > trailing
        expect(to.orders[0].trigger.sell.price).to.equal(1485.99);
        expect(to.orders[0].trigger.sell.trail).to.equal(1516.01);

        to.setPrice(1515); // should not update since price is not < trailing
        expect(to.orders[0].trigger.sell.price).to.equal(1485.99);
        expect(to.orders[0].trigger.sell.trail).to.equal(1516.01);

        to.setPrice(2516.02);
        expect(to.orders[0].trigger.sell.price).to.equal(2490.8598);
        expect(to.orders[0].trigger.sell.trail).to.equal(2541.1802);

        to.setPrice(2491);
        expect(to.orders[0].trigger.sell.price).to.equal(2490.8598);
        expect(to.orders[0].trigger.sell.trail).to.equal(2541.1802);
      });

      it('should emit trigger event', done => {
        to.on('trigger', order => {
          expect(order.trigger.sell).eql({
            price: 1485.99,
            trail: 1516.01
          });
          done();
        });

        to.setPrice(1501); // activates
      });
    });

    describe('when only side and target is specified', () => {
      beforeEach(() => {
        to.orders = [
          { side: 'sell', target: 1500 }
        ];
      });

      it('should trade all available funds', (done) => {
        to.setFunds({ base: 1 });

        to.on('trade', (params) => {
          expect(params.trade).to.eql({
            side: 'sell',
            size: 0.99,
            price: 1500,
            "product_id": "BTC-USD"
          });
          done();
        });

        to.setPrice(1500);
        expect(to.orders[0].trigger.sell.price).to.equal(1500);
        expect(to.orders[0].trigger.sell.trail).to.equal(1500);
        to.setPrice(1500); // needs another one to check  price <= this.trigger.sell.price
      });
    });

    describe('when trailing is an amount and trade is an amount and percentage', () => {
      beforeEach(() => {
        to.orders = [
          { side: 'sell', target: 2000, trailing: { amount: 50 }, trade: { amount: 750, percentage: 0.5 } }
        ]
      });

      it('should calculate trailing', () => {
        to.setPrice(2000);
        expect(to.orders[0].trigger.sell.price).to.equal(1950);
        expect(to.orders[0].trigger.sell.trail).to.equal(2050);
      });

      it('should emit a sell signal', (done) => {
        to.setPrice(2000);

        to.on('trade', (params) => {
          expect(params.trade).to.eql({
            side: 'sell',
            size: +(750 / 1800).toFixed(8),
            price: 1800,
            "product_id": "BTC-USD"
          })
          done();
        });

        to.on('error', done);

        to.setFunds({ base: 1 });
        to.setPrice(1800);
      });
    });
  });

  describe('#buy', () => {
    describe('when trailing is an amount and trade is an amount and percentage', () => {
      beforeEach(() => {
        to.orders = [
          { side: 'buy', target: 1900, trailing: { amount: 50 }, trade: { amount: 750, percentage: 0.5 } }
        ]
      });

      it('should calculate trailing', () => {
        to.setPrice(1800);
        expect(to.orders[0].trigger.buy.price).to.equal(1850);
        expect(to.orders[0].trigger.buy.trail).to.equal(1750);
      });

      it('should emit a buy signal', (done) => {
        to.setFunds({quote: 1750});

        to.on('trade', (params) => {
          expect(params.trade).to.eql({
            side: 'buy',
            size: +(750 / 1850).toFixed(8),
            price: 1850,
            "product_id": "BTC-USD"
          })
          done();
        });

        to.setPrice(1800);
        to.setPrice(1850);
      });

      it('should never increase the buying price', () => {
        to.setPrice(1901);
        expect(to.orders[0].trigger.buy).to.equal(undefined);

        to.setPrice(1900); // should set trail and price
        expect(to.orders[0].trigger.buy.price).to.equal(1950);
        expect(to.orders[0].trigger.buy.trail).to.equal(1850);

        to.setPrice(1949); // should NOT buy since ! price > trigger.price
        expect(to.orders[0].trigger.buy.price).to.equal(1950);
        expect(to.orders[0].trigger.buy.trail).to.equal(1850);

        to.setPrice(1851); // should not update since price > trigger.trail
        expect(to.orders[0].trigger.buy.price).to.equal(1950);
        expect(to.orders[0].trigger.buy.trail).to.equal(1850);

        to.setPrice(1849); // should update since price < trigger.trail
        expect(to.orders[0].trigger.buy.price).to.equal(1899);
        expect(to.orders[0].trigger.buy.trail).to.equal(1799);

        to.setPrice(1898); // should not update again since price is not > trigger.price
        expect(to.orders[0].trigger.buy.price).to.equal(1899);
        expect(to.orders[0].trigger.buy.trail).to.equal(1799);
      });
    });

    describe('when trailing is percentage and trade is an amount', () => {
      beforeEach(() => {
        to.orders = [
          // { side: 'buy', price: 1900, trailing: { amount: 100, percentage: 0.1 }, trade: { amount: 750, percentage: 0.5 } }
          { side: 'buy', target: 1900, trailing: { percentage: 0.041 }, trade: { amount: 750 } }
        ]
      });

      it('should not set until it reaches the limit price', () => {
        to.setPrice(2000);
        expect(to.orders[0].trigger.buy).to.equal(undefined);
      });

      it('should not set until it reaches the limit price', () => {
        to.setPrice(1900);
        expect(to.price).to.equal(1900);
        expect(to.orders[0].trigger.buy.price).to.equal(1977.9);
        expect(to.orders[0].trigger.buy.trail).to.equal(1822.1);
        expect(to.orders[0].trigger.buy.signal).to.equal(undefined);
      });

      it('should recalculate new trailing price', () => {
        to.setPrice(1900);
        to.setPrice(1822);
        expect(to.orders[0].trigger.buy.price).to.equal(1896.702);
        expect(to.orders[0].trigger.buy.trail).to.equal(1747.298);
      });

      it('should emit the buy event', (done) => {
        // TODO: remove error from the emit callback
        to.setFunds({quote: 750})
        to.on('trade', (params) => {
          expect(params.trade).to.eql({
            side: 'buy',
            price: 1978,
            size: +(0.99 * 750 / 1978).toFixed(8),
            "product_id": "BTC-USD"
          })
          done()
        });
        to.setPrice(1900);
        to.setPrice(1978);
      });

      // Failing silently is preferred and logging the error (so it doesn't crash the program).
      xit('should emit an error event when not enough funds', (done) => {
        // to.setFunds() // not funds
        to.on('trade', (params) => {
          expect(params).to.eql({
            side: 'buy',
            price: 1978,
            size: 0
          });
        });

        to.on('error', (error) => {
          expect(error).to.match(/not enough funds/i);
          done();
        });

        to.setPrice(1500);
        expect(to.orders[0].trigger.buy.price).to.equal(1561.5);
        expect(to.orders[0].trigger.buy.trail).to.equal(1438.5);
        to.setPrice(1978);
      });
    });
  });

  describe('#sell and #buy', () => {
    beforeEach(() => {
      to.setFunds({ base: 0.2414421300000000, quote: 2962.0000246543060000 });
      to.setPrice(2048.12000000);

      to.setOrder([
        { side: 'buy', target: 2000, trailing: { percentage: 0.05 }, trade: { percentage: 0.5, amount: 750 } },
        { side: 'sell', target: 3000, trailing: { percentage: 0.05 }, trade: { percentage: 0.5, amount: 250 } }
      ]);
    });

    it('should be able to calulate funds when buying and selling', (done) => {
      to.setFunds({base: 0.00000001, quote: 0.01});

      to.on('trade', (params) => {
        if(params.trade.side === 'buy') {
          expect(to.funds).to.eql({
            base: 0.00000168,
            quote: 0.00499
          });

          expect(params.trade).to.eql({
            price: 3000,
            side: 'buy',
            size: 0.00000167,
            "product_id": "BTC-USD"
          });
        } else {
          expect(to.funds).to.eql({
            base: 8.4e-7,
            quote: 0.0062499999999999995
          });

          expect(params.trade).to.eql({
            price: 1500,
            side: 'sell',
            size: 8.4e-7,
            "product_id": "BTC-USD"
          });
          done()
        }
      });
      to.on('error', (error) => done(`should not error ${error}`));

      to.setPrice(2000);
      expect(to.orders[0].trigger.buy).to.eql({
        price: 2100,
        trail: 1900
      });
      expect(to.orders[0].trigger.sell).to.equal(undefined);
      expect(to.orders.length).to.equal(2);

      to.setPrice(3000);
      to.setPrice(3000); // needs two to check for price
      expect(to.orders.length).to.equal(1);
      expect(to.orders[0].trigger.sell).to.eql({
        price: 2850,
        trail: 3150
      });
      expect(to.orders[0].trigger.buy).to.equal(undefined);
      to.setPrice(1500);
      // done();
    })

    it('should update order with new values', () => {
      to.setPrice(3001); // trailing buy 2100 or set new trail on 1900
      expect(to.orders[1].trigger.sell.price).to.equal(2850.95);
      expect(to.orders[1].trigger.sell.trail).to.equal(3151.05);

      to.setOrder([
        { "side": "buy", "target": 2046, "trailing": { "amount": 50 }, trade: { "percentage": 0.5, "amount": 900 } }
      ]);

      expect(to.orders[0].trigger.buy).to.equal(undefined);
      expect(to.orders[1]).to.equal(undefined);

      to.setPrice(2045);
      expect(to.orders[0].trigger.buy.price).to.equal(2095);
      expect(to.orders[0].trigger.buy.trail).to.equal(1995);
      expect(to.orders[1]).to.equal(undefined);
    });

    it('should emit buy event and delete executed order and update funds', (done) => {
      to.on('trade', (params) => {
        if (params.trade.side === 'buy') {
          expect(params.trade).to.eql({
            side: 'buy',
            price: 2045.36,
            size: +(750 / 2045.36).toFixed(8),
            "product_id": "BTC-USD"
          });

          expect(to.funds).to.eql({
            base: 0.60812575,
            quote: 2211.9999909968
          });
        } else {
          expect(params.trade).to.eql({
            side: 'sell',
            price: 2969.053,
            size: +(250 / 2969.053).toFixed(8),
            "product_id": "BTC-USD"
          });

          expect(to.funds).to.eql({
            base: 0.60812575 - 0.08420193,
            quote: 2211.9999909968 + 0.08420193 * 2969.053
          });

          done();
        }
      });

      to.on('error', done);

      to.setPrice(1047.86000000);
      expect(to.orders[0].trigger.buy).to.eql({
        price: 1100.253, //(1047.86 * 1.051),
        trail: 995.467 //+(1047.86 * (1.0 - 0.05)).toFixed(3)
      })

      expect(to.orders.length).to.equal(2);

      to.setPrice(2045.36000000); // trailing buy 2100 or set new trail on 1900
      expect(to.orders.length).to.equal(1);
      expect(to.orders[0].trigger.buy).to.equal(undefined);
      expect(to.orders[0].trigger.sell).to.equal(undefined);

      to.setPrice(3125.32000000); // should not sell
      expect(to.orders[0].trigger.sell).to.eql({ price: 2969.054, trail: 3281.586 });
      to.setPrice(2969.053); // should sell
    })
  });

  describe('#malformed orders', () => {
    it('should fail when side is not set', (done) => {
      to.on('error', (error) => {
        expect(error).to.match(/side/i);
        done();
      });
      to.setOrder([{hey: 'you'}]);
    });

    it('should emit error event when is not an array', (done) => {
      to.on('error', (error) => {
        expect(error).to.match(/TypeError/i);
        done();
      });
      to.setOrder({});
    });

    it('should emit error event when target price is not specified', (done) => {
      to.on('error', (error) => {
        expect(error).to.match(/target/i);
        done();
      });
      to.setOrder([{side: 'buy'}]);
    });

    it('should not emit error event when is not an array', (done) => {
      to.on('error', done);
      to.setOrder();
      done();
    });
  });

  describe('# funds and execute trades', () =>{
    it('should get funds before doing trades', done =>{
      const { accounts, buy } = require('../../test/responses/gdax');
      trade = sinon.stub().callsFake((p, cb) => cb(null, null, buy));
      funds = sinon.stub().callsFake(cb => cb(null, null, accounts));
      let times = 0;

      to.on('trade', params => {
        times++;

        if(times === 1) {
          sinon.assert.callCount(trade, 1);
          sinon.assert.callCount(funds, 1);

          sinon.assert.calledWith(trade, { price: 3549, product_id: "BTC-USD", side: "buy", size: 0.21132713 });
          expect(to.funds).to.eql({ "base": 0.47683409, "quote": 1462.00001563 });
          // done();
        } else if(times === 2) {
          sinon.assert.callCount(trade, 2);
          sinon.assert.callCount(funds, 2);
          done();
        }
      });

      to.on('error', done);

      to.setOrder([
        { "side": "buy", "target": 3980, "trailing": { "amount": 50 }, "trade": { "percentage": 0.5, "amount": 750 } },
        { "side": "buy", "target": 3500, "trailing": { "amount": 50 }, "trade": { "percentage": 0.5, "amount": 1000 } }
      ]);

      to.setExecuteTradeAction(trade);
      to.setGetFundsAction(funds);

      to.setPrice(4000);

      to.setPrice(3965.06);
      expect(to.orders[0].trigger).to.eql({
        "buy": {
          "price": 4015.06,
          "trail": 3915.06
        }
      });

      to.setPrice(3970.92);
      expect(to.orders[0].trigger).to.eql({
        "buy": {
          price: 4015.06, // price shouldn't go up to 4020.92!
          trail: 3915.06 // trail shouldn't go up to () neither
        }
      });

      to.setPrice(3915.05);
      expect(to.orders[0].trigger).to.eql({
        "buy": {
          price: 3965.05, // price shouldn't go up to 4020.92!
          trail: 3865.05 // trail shouldn't go up to () neither
        }
      });

      to.setPrice(3965.04);

      expect(to.orders[1].trigger.buy).to.equal(undefined);

      to.setPrice(3499);
      expect(to.orders[0].trigger).to.eql({
        "buy": {
          price: 3549, // price shouldn't go up to 4020.92!
          trail: 3449 // trail shouldn't go up to () neither
        }
      });

      expect(to.orders[1].trigger).to.eql({
        "buy": {
          price: 3549, // price shouldn't go up to 4020.92!
          trail: 3449 // trail shouldn't go up to () neither
        }
      });

      to.setPrice(3549);
      to.setPrice(3549); // it needs two cycles one to set trailing and another for pulling the trigger
    });
  });

  describe('# trade issues', () => {
    beforeEach(() => {
      to.setOrder([
        { "side": "sell", "target": 4270, "trailing": { "amount": 150 }, "trade": { "percentage": 0.8 } },
        { "side": "buy", "target": 3700, "trailing": { "amount": 150 }, "trade": { "percentage": 0.5, "amount": 1000 } }
      ]);
      to.setFunds({ base: 0.69975014, quote: 462});

      to.setPrice(4354);
      expect(to.orders[0].trigger.sell.price).to.equal(4204);
      expect(to.orders[0].trigger.sell.trail).to.equal(4504);
    });

    it('number should not be longer than 8 digits', done =>{
      to.on('trade', (params) => {
        expect(params.trade.size).to.equal(0.55980011); // "message": "size too precise (0.559800112)"
        done();
      });

      to.setPrice(4734.42);
      to.setPrice(4283);
    });

    // did not reproduced issue
    xit('should not do multiple trades', done => {
      let trades = 0;
      to.on('trade', (params) => {
        trades++;
      });

      to.setExecuteTradeAction((trade, cb) => {
        setTimeout(function () {
          cb('test done', { statusCode: 400 }, trade); // "message": "size too precise (0.559800112)"
        }, 10);
      });

      to.setPrice(4434.42);
      expect(to.orders[0].trigger.sell.price).to.equal(4284.42);
      expect(to.orders[0].trigger.sell.trail).to.equal(4584.42);

      for(let i = 0; i < 1000; i++) {
        to.setPrice(5400.01 - i);
      }

      setTimeout(() => {
        expect(trades).to.equal(1);
        done();
      }, 90);
    });
  });
});