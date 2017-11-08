const { expect } = require('chai');
const sinon = require('sinon');
const mongo = require('../../ticker/db');
const security = require('./security');

describe('Security', function () {
  this.timeout(100);

  const interval = 5;
  let getOhlcStub;

  beforeEach(() => {
    if (mongo.getOhlc.restore) mongo.getOhlc.restore();
    getOhlcStub = sinon.stub(mongo, 'getOhlc');
  });

  it('should only send data once', done => {
    var array = [];
    var data = [{ _id: 1 }];

    getOhlcStub.resolves(data);

    security('gdax.BTC-USD', '7D', 1, interval).subscribe(ticks => {
      // console.log('ticks', ticks);
      array = array.concat(ticks);
    });

    setTimeout(function() {
      expect(array).to.eql(data);
      done();
    }, interval*2);
  });

  it('should only send different data', done => {
    var array = [];
    var data1 = [{ _id: 1 }];
    var data2 = [{ _id: 2 }];
    var data3 = [{ _id: 3 }];

    getOhlcStub.onCall(0).resolves(data1);
    getOhlcStub.onCall(1).resolves(data1.concat(data2));
    getOhlcStub.onCall(2).resolves(data1.concat(data2));
    getOhlcStub.resolves(data3);

    security('gdax.BTC-USD', '7D', interval, 1).subscribe(ticks => {
      // console.log('----- ticks', ticks);
      array = array.concat(ticks);
    });

    setTimeout(function() {
      expect(array).to.eql(data1.concat(data2, data3));
      done();
    }, interval*2);
  });
});