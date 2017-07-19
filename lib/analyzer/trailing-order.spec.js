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
          expect(params).to.eql({
            side: 'sell',
            size: 1,
            price: 1500
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
          expect(params).to.eql({
            side: 'sell',
            size: +(750 / 1800).toFixed(8),
            price: 1800
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
          expect(params).to.eql({
            side: 'buy',
            size: +(750 / 1850).toFixed(8),
            price: 1850
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
          expect(params).to.eql({
            side: 'buy',
            price: 1978,
            size: +(750 / 1978).toFixed(8)
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
        if (params.side === 'buy') {
          expect(params).to.eql({
            side: 'buy',
            price: 2045.36,
            size: +(750 / 2045.36).toFixed(8)
          });

          expect(to.funds).to.eql({
            base: 0.60812575,
            quote: 2211.9999909968
          });
        } else {
          expect(params).to.eql({
            side: 'sell',
            price: 2969.053,
            size: +(250 / 2969.053).toFixed(8)
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

  // you want to buy at the lowest price possible
  xit('should set trailing buy limit of 2300 when price was 2500', (done) => {
    const to = new TrailingOrder();

    const callback = (params) => {
      expect(params).to.eql({
        side: 'buy',
        price: 1717,
        size: +(1234 * 0.1 / 1717).toFixed(8) // 0.05824112
      });
      done();
    };

    to.setFunds(1234);

    to.setOrder({ buy: { price: 2300, trailing: 0.01, percentage: 0.1, action: callback } });

    to.setPrice(2500); // no trailing
    to.setPrice(2300); // trailing set +/-1% -> [2323 (buy), 2,277 (new trailing)]
    to.setPrice(1700); // trailing set +/-1% -> [1717 (buy), 1683 (new trailing)]
    to.setPrice(1716);
    to.setPrice(1715);
    to.setPrice(1717); // should buy here since it went up for more than a 1%
  });

  xit('should not make the buy without funds', () => {
    const to = new TrailingOrder();

    const callback = (params) => {
      expect(params).to.eql({
        side: 'buy',
        price: 1717,
        size: +(1234 * 0.1 / 1717).toFixed(8) // 0.05824112
      });

      expect(true).to.equal(false); // should not have been called
    };

    to.setOrder({ buy: { price: 2300, trailing: 0.01, percentage: 0.1, action: callback } });

    to.setPrice(2500); // no trailing
    to.setPrice(2300); // trailing set +/-1% -> [2323 (buy), 2,277 (new trailing)]
    to.setPrice(1700); // trailing set +/-1% -> [1717 (buy), 1683 (new trailing)]
    to.setPrice(1716);
    to.setPrice(1715);
    to.setPrice(1717); // should buy here since it went up for more than a 1%
  });

  xit('should emit a buy event', (done) => {
    const to = new TrailingOrder();
    to.setFunds({base: 1, quote: 1});

    to.on('buy', (err, params) => {
      expect(params).to.eql({
        side: 'buy',
        price: 1799,
        size: +(1 * 1 / 1799).toFixed(8)
      });
      done();
    });

    to.setOrder({buy: {price: 1800, trailing: 0.02, percentage: 1}});
    to.setPrice(2301);
    to.setPrice(1500);
    to.setPrice(1799);
  });

  xit('should emit a buy event with error', (done) => {
    const to = new TrailingOrder();

    to.on('buy', (err, params) => {
      expect(err).to.contain('funds');
      expect(params).to.equal(undefined);
      done();
    });

    to.setOrder({ buy: { price: 1800, trailing: 0.02, percentage: 1 } });
    to.setPrice(2301);
    to.setPrice(1500);
    to.setPrice(1799);
  });

  // you want to sell at the highest price possible
  xit('should set a trailing sell with limit on 2000 when price was on 1700', (done) => {
    const to = new TrailingOrder();
    to.setFunds({ quote: 4321, base: 0.17});
    to.setPrice(1700);

    const callback = (params) => {
      expect(params).to.eql({
        side: 'sell',
        price: 1998,
        size: +(0.17 * 0.25).toFixed(8)
      });
      done();
    }

    to.setOrder({ sell: { price: 2000, trailing: 0.005, percentage: 0.25, action: callback } });

    to.setPrice(1999);
    to.setPrice(2000); // trailing: 2010, sell: 1990
    to.setPrice(2001);
    to.setPrice(2010); // trailing: 2020, sell: 2000
    to.setPrice(2001);
    to.setPrice(1998); // should sell here
  });

  xit('should not make the sell', () => {
    const to = new TrailingOrder();
    to.setFunds(4321);
    to.setPrice(1700);

    const callback = (params) => {
      expect(false).to.be(true); // this shouldn't be called since there's not funds to sell

      expect(params).to.eql({
        side: 'sell',
        price: 1998,
        size: +(0 * 0.25).toFixed(8)
      });
      // done();
    }

    to.setOrder({ sell: { price: 2000, trailing: 0.005, percentage: 0.25, action: callback }});

    to.setPrice(1999);
    to.setPrice(2000); // trailing: 2010, sell: 1990
    to.setPrice(2001);
    to.setPrice(2010); // trailing: 2020, sell: 2000
    to.setPrice(2001);
    to.setPrice(1998); // should sell here
  });

  xit('should emit a sell event', (done) => {
    const to = new TrailingOrder();
    to.setFunds({ base: 2, quote: 1 });

    to.on('sell', (err, params) => {
      expect(params).to.eql({
        side: 'sell',
        price: 1500,
        size: +(2 * 0.9).toFixed(8)
      });
      done();
    });

    to.setOrder({ sell: { price: 1800, trailing: 0.02, percentage: 0.9 } });
    to.setPrice(2301);
    to.setPrice(1500);
  });

  xit('should emit a sell event with error', (done) => {
    const to = new TrailingOrder();

    to.on('sell', (err, params) => {
      expect(err).to.contain('funds');
      expect(params).to.equal(undefined);
      done();
    });

    to.setOrder({ sell: { price: 1800, trailing: 0.02, percentage: 1 } });
    to.setPrice(2301);
    to.setPrice(1500);
  });

  xit('should execute selling and buying on the same limit', (done) => {
    const to = new TrailingOrder();
    to.setFunds({ base: 1, quote: 1000});
    to.setPrice(2500);

    const buyCallback = (params) => {
      // console.log('buying', params);
      expect(params).to.eql({
        side: 'buy',
        price: 1709,
        size: +(1000 * 0.5 / 1709).toFixed(8)
      });
    };

    const sellCallback = (params) => {
      // console.log('selling', params);
      expect(params).to.eql({
        side: 'sell',
        price: 3900,
        size: +(+(1000 * 0.5 / 1709 + 1).toFixed(8) * 0.8).toFixed(8)
      });
      done();
    }

    to.setOrder({
      buy: { price: 2000, trailing: 0.004, percentage: 0.5, action: buyCallback },
      sell: { price: 3000, trailing: 0.003, percentage: 0.8, action: sellCallback}
    });

    to.setPrice(1700); // 8
    to.setPrice(1709); // buy
    to.setPrice(2999);
    to.setPrice(3000);
    to.setPrice(4000);
    to.setPrice(3900); // sell
  });

  xit('should trade with whatever is less between amount or percentage of total funds', (done) => {
    const to = new TrailingOrder();
    to.setFunds({ base: 0.2414421300000000, quote: 2962.0000246543060000 });
    to.setPrice(2574);

    to.on('buy', (error, params) => {
      expect(error).to.equal(null);
      expect(params).to.eql({
        side: 'buy',
        price: 1995,
        size: +(750/1995).toFixed(8)
      });
    });

    to.on('sell', (error, params) => {
      expect(error).to.equal(null);
      expect(params).to.eql({
        side: 'sell',
        price: 3500,
        size: +(250 / 3500).toFixed(8)
      });
      done();
    })

    to.setOrder({ buy: { price: 2000, trailing: 0.05, percentage: 0.5, amount: 750},
      sell: { price: 3000, trailing: 0.05, percentage: 0.5, amount: 250}});

    to.setPrice(2100);

    to.setPrice(2000); // trailing buy 2100 or set new trail on 1900
    expect(to.trigger.buy.price).to.equal(1995);
    expect(to.trigger.buy.trail).to.equal(1805);

    to.setPrice(1993);
    to.setPrice(1994);
    to.setPrice(1995); // buy
    to.setPrice(1996);
    to.setPrice(4000);
    to.setPrice(3500); // sell
  });

  xit('use trailing amouts', (done) => {
    const to = new TrailingOrder();
    to.setFunds({ base: 0.2414421300000000, quote: 2962.0000246543060000 });
    to.setPrice(2048.12000000);

    to.on('buy', (error, params) => {
      expect(error).to.equal(null);
      expect(params).to.eql({
        side: 'buy',
        price: 2125.32,
        size: +(900 / 2125.32).toFixed(8)
      });
      done();
    });

    to.on('sell', (error, params) => {
      expect(false).to.equal(true);
    })

    to.setOrder({
      buy: { price: 2000, trailing: 0.05, percentage: 0.5, amount: 750 },
      sell: { price: 3000, trailing: 0.05, percentage: 0.5, amount: 250 }
    });

    to.setPrice(2000); // trailing buy 2100 or set new trail on 1900
    expect(to.buyingPrice).to.equal(2100);
    expect(to.trigger.buy.trail).to.equal(1900);

    console.log('==================')

    to.setOrder({
      "buy": { "price": 2046, "trailing": 0.03, "percentage": 0.5, "amount": 900 }
    });

    expect(to.buyingPrice).to.equal(undefined);
    expect(to.trigger.buy.trail).to.equal(undefined);

    to.setPrice(2047.86000000);
    to.setPrice(2046.36000000); // trailing buy 2100 or set new trail on 1900
    expect(to.buyingPrice).to.equal(undefined);
    expect(to.trigger.buy.trail).to.equal(2046);

    to.setPrice(2045.45000000); // break trailing
    expect(to.buyingPrice).to.equal(2106.8135);
    expect(to.trigger.buy.trail).to.equal(1984.0865);

    to.setPrice(2037.96000000);
    expect(to.buyingPrice).to.equal(2106.8135);
    expect(to.trigger.buy.trail).to.equal(1984.0865);

    to.setPrice(2035.20000000);
    expect(to.buyingPrice).to.equal(2106.8135);
    expect(to.trigger.buy.trail).to.equal(1984.0865);

    to.setPrice(2034.95000000);
    to.setPrice(2031.96000000);
    to.setPrice(2034.10000000);
    to.setPrice(2029.80000000);
    to.setPrice(2025.32000000);
    to.setPrice(2125.32000000); // sell
  });

  xit('should trade without percentage just with the amount specified', () => {
    const buy = { "buy": { "price": 1900, "trailing": 0.05, "amount": 900 } };

    const to = new TrailingOrder();
    to.setFunds({ base: 0.2414421300000000, quote: 2012.0000246543060000 });
    to.setOrder(buy);

    to.setPrice(1875.51000000);
    expect(to.buyingPrice).to.equal(1969.2855000000002);
    expect(to.trigger.buy.trail).to.equal(1781.7344999999998);
  });

});