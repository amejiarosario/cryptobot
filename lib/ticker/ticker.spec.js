const sinon = require('sinon');
const { expect, assert } = require('chai');
const { Observable } = require('rxjs/Rx');

const ticker = require('./ticker');
const gdax = require('../providers/gdax');
const amqp = require('../messaging/amqp');
const config = require('../../config');
const gdaxFunds = require('../../test/responses/gdax-funds');

describe('Ticker', function () {
  this.timeout(500);

  afterEach(() => {
    if (gdax.tickerObservable.restore) gdax.tickerObservable.restore();
    if (gdax.getFunds.restore) gdax.getFunds.restore();
    if (gdax.executeTrade.restore) gdax.executeTrade.restore();
    if (gdax.ticker.restore) gdax.ticker.restore();
    if (amqp.serverObservable.restore) amqp.serverObservable.restore();
  })

  describe('Provider market ticks', () => {
    it('should call the ticker function on the provider', done => {
      sinon.stub(gdax, 'tickerObservable').returns(getTicksObservable([10], 15, { product_id: 'ETH-USD' }));
      sinon.stub(amqp, 'serverObservable').returns(Observable.never());

      const providers = {
        'gdax': ['ETH-USD']
      };

      ticker(providers).subscribe(
        data => {
          expect(data.event).to.equal('tick');
          expect(data.price).to.equal(10);
          expect(data.product_id).to.equal('ETH-USD');
          done();
        },
        error => done(new Error(error))
      );

    });
  });

  describe('Listen for orders', () => {
    it('should not add an order without provider ');
  });

  describe('Execute orders on Provider', () => {
    it('should set a trailing order when gets order via amqp and execute order', (done) => {
      const orders = { 'gdax.BTC-USD': [{ "side": "buy", "target": 2046, "trailing": { "amount": 50, "percentage": 0.5 }, trade: { "percentage": 0.5, "amount": 900 } }] };
      const providers = { 'gdax': ['BTC-USD', 'ETH-BTC']};
      const executeTradeSpy = sinon.spy();
      let orderCalled = false;

      sinon.stub(amqp, 'serverObservable').returns(Observable.of(orders));
      sinon.stub(gdax, 'tickerObservable').returns(getTicksObservable([1500, 1510, 2000], 10));
      sinon.stub(gdax, 'setOrder').callsFake(executeTradeSpy);
      sinon.stub(gdax, 'getFunds').callsFake(cb => cb(gdaxFunds));

      const observable = ticker(providers);

      observable.subscribe(
        data => {
          if(data.event === 'order') {
            expect(data.order).to.eql(orders);
            orderCalled = true;
          }
          if(data.event === 'trade') {
            expect(data).to.eql({
              event: 'trade',
              price: 2000,
              product_id: 'BTC-USD',
              provider: 'gdax',
              size: 0.45,
              side: 'buy'
            });

            expect(executeTradeSpy.called).to.equal(true);
            console.log(executeTradeSpy.getCall(0).args[0])
            expect(executeTradeSpy.getCall(0).args[0]).to.eql({ side: 'buy', size: 0.45, price: 2000, product_id: 'BTC-USD'});
            expect(orderCalled).to.equal(true);
            done();
          }
        },
        error => done(new Error(error))
      );
    });
  });

  describe('Save data by minute/pair/provider', () => {

  });

  describe('Working with multiple pairs BTC/USD, ETH/USD, LTC/USD', () => { });
  describe('Working with multiple provides GDAX, Poloniex', () => { });

  it('should remove/repurpose the index.js file')
});

function getTicksObservable(values, delay = 10, object = { product_id: 'BTC-USD' }) {
  return Observable.of.apply(null, values)
    .concatMap(x => Observable.of( Object.assign({ price: x }, object) )
      .delay(delay))
}