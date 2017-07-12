const expect = require('chai').expect;
const TrailingOrder = require('../lib/trailing-order');

// TODO: add coverage

/**
 * Set a trailing buy stop,
 */
describe('Trailing Price', function() {
  this.timeout(300);

  it('should be true', () => {
    expect(true).to.equal(true);
  });

  // you want to buy at the lowest price possible
  it('should set trailing buy limit of 2300 when price was 2500', (done) => {
    const to = new TrailingOrder();

    const callback = (params) => {
      expect(params).to.eql({
        side: 'buy',
        price: 1717,
        size: +(1000 * 0.1 / 1717).toFixed(8) // 0.05824112
      });
      done();
    };

    to.funds(1000);
  
    to.limits({ buy: { price: 2300, trailing: 0.01, percentage: 0.1, action: callback } });

    to.ticker(2500); // no trailing
    to.ticker(2300); // trailing set +/-1% -> [2323 (buy), 2,277 (new trailing)]
    to.ticker(1700); // trailing set +/-1% -> [1717 (buy), 1683 (new trailing)]
    to.ticker(1716);
    to.ticker(1715);
    to.ticker(1717); // should buy here since it went up for more than a 1%
  });

  // you want to sell at the highest price possible
  it('should set a trailing sell with limit on 2000 when price was on 1700', () => {
    const to = new TrailingOrder();
    to.funds(1000);
    to.ticker(1700);

    const callback = (params) => {
      expect(params).to.eql({
        side: 'sell',
        price: 2000,
        size: +(1000 * 0.25 / 2500).toFixed(8)
      });
    }

    to.limits({ sell: { price: 2000, trailing: 0.05, percentage: 0.25, action: callback }});
    to.ticker(1999);
    to.ticker(2000); // trailing: 2010, sell: 1990 
    to.ticker(2001);
    to.ticker(2010); // trailing: 2020, sell: 2000
    to.ticker(2001);
    to.ticker(2000); // should sell here
  });
});