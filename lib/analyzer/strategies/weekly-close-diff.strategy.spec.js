const { expect } = require('chai');
const sinon = require('sinon');
const { Subject } = require('rxjs');

const amqp = require('../../messaging/amqp');
const security = require('./security');
const securityStub = sinon.stub(security, 'security');
const {Strategy} = require('./strategy');
const entryStub = sinon.stub(Strategy.long, 'entry');
const exitStub = sinon.stub(Strategy.long, 'exit');
const WeeklyCloseDiffStrategy = require('./weekly-close-diff.strategy');

describe('WeeklyCloseDiffStrategy', function () {
  this.timeout(100);
  let strat;
  let observable;

  beforeEach(() => {
    strat = new WeeklyCloseDiffStrategy();
    observable = new Subject();
    securityStub.returns(observable);
    strat.start();
    reset();
  });

  describe('# Start', () => {

    it('should make an entry on down followed by a upward trend', () => {
      const closeArray = [11, 10, 15];
      observable.next(closeArray.map(t => ({close: t})));
      expect(exitStub.called).to.eql(false);
      expect(entryStub.called).to.eql(true);
    });

    it('should save previous ticks history and should make an entry on double down followed by a upward trend', () => {
      let closeArray = [11];
      observable.next(closeArray.map(t => ({ close: t })));
      expect(strat.closeDiff.out).to.eql([null]);
      expect(exitStub.called).to.eql(false);
      expect(entryStub.called).to.eql(false);
      reset();

      closeArray = [10];
      observable.next(closeArray.map(t => ({ close: t })));
      expect(strat.closeDiff.out).to.eql([null, -0.09090909090909091]);
      expect(exitStub.called).to.eql(false);
      expect(entryStub.called).to.eql(false);
      reset();

      closeArray = [9];
      observable.next(closeArray.map(t => ({ close: t })));
      expect(strat.closeDiff.out).to.eql([null, -0.09090909090909091, -0.1]);
      expect(exitStub.called).to.eql(false);
      expect(entryStub.called).to.eql(false);
      reset();

      closeArray = [16];
      observable.next(closeArray.map(t => ({ close: t })));
      expect(strat.closeDiff.out).to.eql([null, -0.09090909090909091, -0.1, 0.7777777777777778]);
      expect(exitStub.called).to.eql(false);
      expect(entryStub.called).to.eql(true);
    });

    it('should exit on up followed by a downward trend', () => {
      const closeArray = [14, 15, 10];
      observable.next(closeArray.map(t => ({close: t})));
      expect(exitStub.called).to.eql(true);
      expect(entryStub.called).to.eql(false);
    });

    it('should entry if the end is on upward trend', () => {
      const closeArray = [15, 10, 18];
      observable.next(closeArray.map(t => ({ close: t })));
      expect(exitStub.called).to.eql(false);
      expect(entryStub.called).to.eql(true);
    });

    it('should handle empty arrays', () => {
      const closeArray = [];
      observable.next(closeArray.map(t => ({ close: t })));
      expect(exitStub.called).to.eql(false);
      expect(entryStub.called).to.eql(false);
    });

    it('should should not trade if there is no change', () => {
      const closeArray = [10, 10];
      observable.next(closeArray.map(t => ({ close: t })));
      expect(exitStub.called).to.eql(false);
      expect(entryStub.called).to.eql(false);
    });
  });
});

function reset() {
  entryStub.reset();
  exitStub.reset();
}