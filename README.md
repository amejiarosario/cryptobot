# Cryptobot

:moneybag: :robot: Cryptocurrency trading bot for multiple platforms and coins (gdax/coinbase & dollar/bitcoin/ethereum/litecoin)

This is a multi-currency trading bot. It's primary purpose was to automate trading cryptocurrency, however it can be use to trade forex, stocks and index funds once you made the API integration.

# Strategies

There are multiple strategies and depending on what your goals are you might choose one of the following.

## Buy and hold

It's very hard to time the market even with automated tools like this. So, one strategy that can work for you is buying and holding. This espcially useful when you know the main trend is upward. Let's say you bet in the US market going up over the years. In that case, you can buy and hold. This will also avoid you trading fees, commisions and capital gains taxes (if applies).

## Buy low and sell high

This strategy applies for everything. However, it is specially useful when trading currencies. The market is very volatile so you want to ensure you buy to the lowest price and sell high. It's up to you to choose the time range when this is going to happen (1h, 1d, or 1y).

# Technical Analysis

Again there is a lot to choose from. So this bot uses a combination of multiple ones to give you the best results for your strategy.

# Notes

- CLI tool that runs in the background
- produces logs and also has a command colored logs stdout
- unit test for all functions
- every function is documented
- integration test to test strategies with real market data
- try to avoid takers side (market orders) and favor makers side (limit and stop orders)

# Questions

- How's price set on the market? If somebody set a sell price that is in the range of a buy order do both get matched even if the current market price hasn't reach that yet?


# Dependencies

```
npm install pm2 -g

pm2 start --name="ticker" ./cli.js -- ticker
pm2 ls
pm2 stop
```

# Possible deps

```
var z = require('zero-fill')
  , n = require('numbro')

        cols.push(z(8, n(s.period.macd_histogram).format('+00.0000'), ' ')[color])
        cols.push(z(8, n(s.period.overbought_rsi).format('00'), ' ').cyan)
```

# Notes

Ticks aggregation (min, hr, day, wk, month)
  - open
  - close
  - high
  - low
  - sold (volume)
  - bought (volume)

```js

// Transform data (date and get sold and bought from $side and $size)
var project = { $project : {
  _id: 0,
  price: 1,
  sold: { $cond: [{$eq: ['$side', 'sell']}, '$size', 0] },
  bought: { $cond: [{$eq: ['$side', 'buy']}, '$size', 0] },
  year: { $year: "$time" },
  month: { $month: "$time" },
  week: { $week: "$time" },
  day: { $dayOfMonth: "$time" },
  hour: { $hour: "$time" },
  minute: { $minute: "$time" },
}};

// Group by time
var group = { $group: {
    _id : { year: '$year', month: '$month', week: '$week', day: '$day', hour: '$hour', minute: '$minute' },
    open: { $first: '$price' },
    close: { $last: '$price' },
    high: { $max: '$price' },
    low: { $min: '$price' },
    sold: { $sum: '$sold' },
    bought: { $sum: '$bought' },
    num: { $sum: 1 }
}}

db.getCollection('btc-usd-ticker').aggregate([project, group]);
```


Orderbook (Market depth)
  - sell orders volume & limits
  - buy orders volume & limits

Websocket ticker
```js
{ type: 'received',
  order_id: 'e99e1a38-be4f-433d-8341-a5ec70d431a5',
  order_type: 'limit',
  size: '0.09199000',
  price: '2583.88000000',
  side: 'sell',
  product_id: 'BTC-USD',
  sequence: 3510553182,
  time: '2017-07-06T16:00:12.075000Z' }

{ type: 'received',
  order_id: '0995570a-4e96-436b-8d7d-991e8eff3b04',
  order_type: 'market',
  size: '0.16730000',
  side: 'buy',
  funds: '432.2831240000000000',
  product_id: 'BTC-USD',
  sequence: 3510553461,
  time: '2017-07-06T16:00:15.098000Z' }  

// remaining: 0.07531 (0.1673 - 0.09199)
{ type: 'match',
  trade_id: 17783459,
  maker_order_id: 'e99e1a38-be4f-433d-8341-a5ec70d431a5',
  taker_order_id: '0995570a-4e96-436b-8d7d-991e8eff3b04',
  side: 'sell',
  size: '0.09199000',
  price: '2583.88000000',
  product_id: 'BTC-USD',
  sequence: 3510553462,
  time: '2017-07-06T16:00:15.098000Z' }

{ type: 'done',
  side: 'sell',
  order_id: 'e99e1a38-be4f-433d-8341-a5ec70d431a5',
  reason: 'filled',
  product_id: 'BTC-USD',
  price: '2583.88000000',
  remaining_size: '0.00000000',
  sequence: 3510553463,
  time: '2017-07-06T16:00:15.098000Z' }

{ type: 'done',
  side: 'buy',
  order_id: '0995570a-4e96-436b-8d7d-991e8eff3b04',
  reason: 'filled',
  product_id: 'BTC-USD',
  remaining_size: '0.00000000',
  sequence: 3510553465,
  time: '2017-07-06T16:00:15.098000Z' }

// Another match

{ type: 'received',
  order_id: 'ced7415c-072c-4544-a0c7-f0d9d1ddac41',
  order_type: 'limit',
  size: '0.09787000',
  price: '2583.88000000',
  side: 'sell',
  product_id: 'BTC-USD',
  sequence: 3510553445,
  time: '2017-07-06T16:00:14.023000Z' }

{ type: 'open',
  side: 'sell',
  price: '2583.88000000',
  order_id: 'ced7415c-072c-4544-a0c7-f0d9d1ddac41',
  remaining_size: '0.09787000',
  product_id: 'BTC-USD',
  sequence: 3510553446,
  time: '2017-07-06T16:00:14.023000Z' }

{ type: 'match',
  trade_id: 17783460,
  maker_order_id: 'ced7415c-072c-4544-a0c7-f0d9d1ddac41',
  taker_order_id: '0995570a-4e96-436b-8d7d-991e8eff3b04',
  side: 'sell',
  size: '0.07531000',
  price: '2583.88000000',
  product_id: 'BTC-USD',
  sequence: 3510553464,
  time: '2017-07-06T16:00:15.098000Z' }

{ type: 'done',
  side: 'buy',
  order_id: '0995570a-4e96-436b-8d7d-991e8eff3b04',
  reason: 'filled',
  product_id: 'BTC-USD',
  remaining_size: '0.00000000',
  sequence: 3510553465,
  time: '2017-07-06T16:00:15.098000Z' }  

{ type: 'done',
  side: 'sell',
  order_id: 'ced7415c-072c-4544-a0c7-f0d9d1ddac41',
  reason: 'canceled',
  product_id: 'BTC-USD',
  price: '2583.88000000',
  remaining_size: '0.02256000',
  sequence: 3510554226,
  time: '2017-07-06T16:00:20.120000Z' }  

```


# Archive

```js
//*
var project = { $project : {
  _id: 0,
  price: 1,
  size: 1,    
  side : 1,
  year: { $year: "$time" },
  month: { $month: "$time" },
  week: { $week: "$time" },
  day: { $dayOfMonth: "$time" },
  hour: { $hour: "$time" },
  minute: { $minute: "$time" },
}};

var groupByMinute = { $group: {
    _id : { year: '$year', month: '$month', week: '$week', day: '$day', $hour: '$hour', $minute: '$minute' },
    open: { $first: '$price' },
    close: { $last: '$price' },
    high: { $max: '$price' },
    low: { $min: '$price' },
    vol: { $sum: '$size' },
    num: { $sum: 1 }
}}

db.getCollection('btc-usd-ticker').aggregate([project, groupByMinute]);
//*/
```