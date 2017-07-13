const expect = require('chai').expect;
const TrailingOrder = require('../lib/trailing-order');

// TODO: add coverage

/**
 * Set a trailing buy stop,
 */
describe('Trailing Price', function() {
  this.timeout(300);

  // you want to buy at the lowest price possible
  it('should set trailing buy limit of 2300 when price was 2500', (done) => {
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

  it('should not make the buy without funds', () => {
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

  // you want to sell at the highest price possible
  it('should set a trailing sell with limit on 2000 when price was on 1700', (done) => {
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

  it('should not make the sell', () => {
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

  it('should execute selling and buying on the same limit', (done) => {
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
});