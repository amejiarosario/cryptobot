# cloud mongos
- ds151232.mlab.com:51232/heroku_2frz56zq (current)
*   mongo ds151232.mlab.com:51232/heroku_2frz56zq -u heroku_2frz56zq -p dlpne93p29659v6esqcne5unrp
*   mongodb://heroku_2frz56zq:dlpne93p29659v6esqcne5unrp@ds151232.mlab.com:51232/heroku_2frz56zq
- ds145639.mlab.com:45639/heroku_k9c7jrsc (empty)
- 104.131.94.76:27017/crydb
*  mongo 104.131.94.76:27017/crydb -u cryuser -p cryP@ssw0rd!
*  mongo 104.131.94.76:27017/crydb -u crybot -p CrySkittles123
*  mongodb://crybot:CrySkittles123@104.131.94.76:27017/crydb

# Backup Database

```sh
# backup
mongodump -h ds151232.mlab.com:51232 -d heroku_2frz56zq -u heroku_2frz56zq -p dlpne93p29659v6esqcne5unrp -o data

# import backup
mongorestore -h localhost:27017 -d crybackup data/heroku_2frz56zq/
```

# backup JSON

```sh
# get data backup
mongoexport -h ds151232.mlab.com:51232 -d heroku_2frz56zq -c btc-usd-ticker -u heroku_2frz56zq -p dlpne93p29659v6esqcne5unrp -o data/btc-usd-ticker.json
mongoexport -h ds151232.mlab.com:51232 -d heroku_2frz56zq -c eth-usd-ticker -u heroku_2frz56zq -p dlpne93p29659v6esqcne5unrp -o data/eth-usd-ticker.json

# import data # mongoimport -h ds151232.mlab.com:51232 -d heroku_2frz56zq -c <collection> -u <user> -p <password> --file <input file>
mongoimport -h localhost:27017 -d crybackup -c btc-usd-ticker --file data/btc-usd-ticker.json
mongoimport -h localhost:27017 -d crybackup -c eth-usd-ticker --file data/eth-usd-ticker.json
```
# Notes

Ticks aggregation (min, hr, day, wk, month)
  - open
  - close
  - high
  - low
  - sold (volume)
  - bought (volume)
  - volume (sold+bought)


min
  - miliseconds values 1000
hr
  - minutes values 60
day
  - hours values 24
wk
  - days values 7
mo
  - days values 28-31

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
var group = {
    _id : { year: '$year', week: '$week', month: '$month', day: '$day', hour: '$hour', minute: '$minute' },
    open: { $first: '$price' },
    close: { $last: '$price' },
    high: { $max: '$price' },
    low: { $min: '$price' },
    sold: { $sum: '$sold' },
    bought: { $sum: '$bought' },
    num: { $sum: 1 }
}

var byMinute = [project, {$group: group}, {$limit: 60}];

// By Hour
var groupByHour = Object.assign({}, group, {_id : { year: '$year', week: '$week', month: '$month', day: '$day', hour: '$hour' }});
var byHour = [project, {$group: groupByHour}, {$limit: 24 }];

// By Day

var groupByDay = Object.assign({}, group, {_id : { year: '$year', week: '$week', month: '$month', day: '$day' }});
var byDay = [project, {$group: groupByDay}, {$limit: 7 }];

// By Week

var groupByWeek = Object.assign({}, group, {_id : { year: '$year', month: '$month', week: '$week' }});
var byWeek = [project, {$group: groupByWeek}, {$limit: 4 }];

// By Month

var groupByMonth = Object.assign({}, group, {_id : { year: '$year', month: '$month' }});
var byMonth = [project, {$group: groupByMonth}, {$limit: 12 }];

// volatility
//{ $subtract: ['$high', '$low'] } //{ $divide: [ , '$open' ] }
var volatilityMap = { $project: {
    _id: 0,
    diff: { $subtract: ['$high', '$low'] },
    volatility: { $divide: [ { $multiply: [{ $subtract: ['$high', '$low'] }, 100]} , '$open' ] }
}};

var volatilityReduce = { $group: {
    _id: null,
    high: { $max: '$volatility'},
    avg: { $avg: '$volatility' },
    low: { $min: '$volatility' },
    highDiff: { $max: '$diff'},
    avgDiff: { $avg: '$diff' },
    lowDiff: { $min: '$diff' }
}};



db.getCollection('btc-usd-ticker').aggregate(byMinute.concat(volatilityMap, volatilityReduce));
db.getCollection('btc-usd-ticker').aggregate(byHour.concat(volatilityMap, volatilityReduce));
db.getCollection('btc-usd-ticker').aggregate(byDay.concat(volatilityMap, volatilityReduce));
db.getCollection('btc-usd-ticker').aggregate(byWeek.concat(volatilityMap, volatilityReduce));
// db.getCollection('btc-usd-ticker').aggregate(byMonth.concat(volatilityMap, volatilityReduce));

// db.getCollection('btc-usd-ticker').aggregate(byMinute);
// db.getCollection('btc-usd-ticker').aggregate(byHour);
// db.getCollection('btc-usd-ticker').aggregate(byDay);
// db.getCollection('btc-usd-ticker').aggregate(byWeek);
// db.getCollection('btc-usd-ticker').aggregate(byMonth);

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
