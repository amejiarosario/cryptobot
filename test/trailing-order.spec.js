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

  it('should set trailing buy limit of 2300 when price was 2500', (done) => {
    const tp = new TrailingOrder();

    const callback = (params) => {
      expect(params).to.eql({
        side: 'buy',
        price: 1717,
        size: +(1000 * 0.1 / 1717).toFixed(8) // 0.05824112
      });
      done();
    };

    tp.funds(1000);
    
    tp.limits({ lte: { price: 2300, trailing: 0.01, action: { side: 'buy', percentage: 0.1, callback: callback } }})

    tp.ticker(2500); // no trailing
    tp.ticker(2300); // trailing set +/-1% -> [2323 (buy), 2,277 (adjust trailing)]
    tp.ticker(1700); // trailing set +/-1% -> [1717 (buy), 1683 (adjust trailing)]
    tp.ticker(1716);
    tp.ticker(1715);
    tp.ticker(1717); // should buy here since it went up for more than a 1%
  });
});