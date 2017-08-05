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
        expect(to.trigger.sell).to.equal(undefined);
      });

      it('should set trail values', () => {
        to.setPrice(2000);
        expect(to.trigger.sell).to.not.equal(undefined);
        expect(to.trigger.sell.price).to.equal(1980);
        expect(to.trigger.sell.trail).to.equal(2020);
      })
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
            size: 1,
            price: 1500,
            "product_id": "BTC-USD"
          });
          done();
        });

        to.setPrice(1500);
        expect(to.trigger.sell.price).to.equal(1500);
        expect(to.trigger.sell.trail).to.equal(1500);
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
        expect(to.trigger.sell.price).to.equal(1950);
        expect(to.trigger.sell.trail).to.equal(2050);
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
        expect(to.trigger.buy.price).to.equal(1850);
        expect(to.trigger.buy.trail).to.equal(1750);
      });

      it('should emit a buy signal', (done) => {
        to.setFunds(1750);

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
        expect(to.trigger.buy).to.equal(undefined);
      });

      it('should not set until it reaches the limit price', () => {
        to.setPrice(1900);
        expect(to.trigger.current).to.equal(1900);
        expect(to.trigger.buy.price).to.equal(1977.9);
        expect(to.trigger.buy.trail).to.equal(1822.1);
        expect(to.trigger.buy.signal).to.equal(undefined);
      });

      it('should recalculate new trailing price', () => {
        to.setPrice(1900);
        to.setPrice(1822);
        expect(to.trigger.buy.price).to.equal(1896.702);
        expect(to.trigger.buy.trail).to.equal(1747.298);
      });

      it('should emit the buy event', (done) => {
        // TODO: remove error from the emit callback
        to.setFunds(750)
        to.on('trade', (params) => {
          expect(params.trade).to.eql({
            side: 'buy',
            price: 1978,
            size: +(750 / 1978).toFixed(8),
            "product_id": "BTC-USD"
          })
          done()
        });
        to.setPrice(1900);
        to.setPrice(1978);
      });

      it('should emit an error event when not enough funds', (done) => {
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
        expect(to.trigger.buy.price).to.equal(1561.5);
        expect(to.trigger.buy.trail).to.equal(1438.5);
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
      expect(to.trigger.buy).to.eql({
        price: 2100,
        trail: 1900
      });
      expect(to.trigger.sell).to.equal(undefined);
      expect(to.orders.length).to.equal(2);

      to.setPrice(3000);
      to.setPrice(3000); // needs two to check for price
      expect(to.orders.length).to.equal(1);
      expect(to.trigger.sell).to.eql({
        price: 2850,
        trail: 3150
      });
      expect(to.trigger.buy).to.equal(undefined);
      to.setPrice(1500);
      // done();
    })

    it('should update order with new values', () => {
      to.setPrice(3001); // trailing buy 2100 or set new trail on 1900
      expect(to.trigger.sell.price).to.equal(2850.95);
      expect(to.trigger.sell.trail).to.equal(3151.05);

      to.setOrder([
        { "side": "buy", "target": 2046, "trailing": { "amount": 50 }, trade: { "percentage": 0.5, "amount": 900 } }
      ]);

      expect(to.trigger.buy).to.equal(undefined);
      expect(to.trigger.sell).to.equal(undefined);

      to.setPrice(2045);
      expect(to.trigger.buy.price).to.equal(2095);
      expect(to.trigger.buy.trail).to.equal(1995);
      expect(to.trigger.sell).to.equal(undefined);
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
      expect(to.trigger.buy).to.eql({
        price: 1100.253, //(1047.86 * 1.051),
        trail: 995.467 //+(1047.86 * (1.0 - 0.05)).toFixed(3)
      })

      expect(to.orders.length).to.equal(2);

      to.setPrice(2045.36000000); // trailing buy 2100 or set new trail on 1900
      expect(to.orders.length).to.equal(1);
      expect(to.trigger.buy).to.equal(undefined);
      expect(to.trigger.sell).to.equal(undefined);

      to.setPrice(3125.32000000); // should not sell
      expect(to.trigger.sell).to.eql({ price: 2969.054, trail: 3281.586 });
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

});