const { expect } = require('chai');
const sinon = require('sinon');

const DiffPercentage = require('./diff-percentage.indicator');

describe('Diff Percentage Indicator', function () {
  this.timeout(100);

  describe('#update', () => {
    let dp;

    beforeEach(() => {
      dp = new DiffPercentage(3);
    });

    it('no value', () => {
      const actual = dp.update();
      const expected = [];
      expect(actual).to.eql(expected);
    });

    it('should return null with 1 value', () =>{
      const actual = dp.update(0);
      const expected = [null];
      expect(actual).to.eql(expected);
    });

    it('should rotate numbers after the period', () => {
      const input = [10, 7.5, 1.5];
      dp.update();
      dp.update(20);
      const actual = dp.update(input);
      const expected = [-0.5, -0.25, -0.8];
      expect(dp.in).to.eql(input);
      expect(actual).to.eql(expected);
    });
  });
});