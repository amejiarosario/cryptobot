# cloud mongos
- ds151232.mlab.com:51232/heroku_2frz56zq (current)
*   mongo ds151232.mlab.com:51232/heroku_2frz56zq -u heroku_2frz56zq -p dlpne93p29659v6esqcne5unrp
*   mongodb://heroku_2frz56zq:dlpne93p29659v6esqcne5unrp@ds151232.mlab.com:51232/heroku_2frz56zq
- ds145639.mlab.com:45639/heroku_k9c7jrsc (empty)
- 104.131.94.76:27017/crydb
*  mongo 104.131.94.76:27017/crydb -u cryuser -p cryP@ssw0rd!
*  mongo 104.131.94.76:27017/crydb -u crybot -p CrySkittles123
*  mongodb://cryuser:CrySkittles123@104.131.94.76:27017/crydb
*  mongodb://cryuser:pass-mongodb-1gb-nyc3-01@165.227.113.186/crydb

# Backup Database

```sh
# backup
mongodump -h ds151232.mlab.com:51232 -d heroku_2frz56zq -u heroku_2frz56zq -p dlpne93p29659v6esqcne5unrp -o data
mongodump -h 104.131.94.76:27017 -d crydb -u crybot -p CrySkittles123 -o data

mongodump -h 104.131.94.76:27017 -d crydb -u crybot -p CrySkittles123 -o data/mongodb-512mb-nyc3-01/
mongodump --db crybot2 -o data/crybot2/

# import backup
mongorestore -h localhost:27017 -d crybackup2 data/heroku_2frz56zq/
mongorestore -h localhost:27017 -d crybackup3 data/mongodb-512mb-nyc3-01/crydb/

```

# backup JSON

```sh
# get data backup
mongoexport -h ds151232.mlab.com:51232 -d heroku_2frz56zq -c btc-usd-ticker -u heroku_2frz56zq -p dlpne93p29659v6esqcne5unrp -o data/btc-usd-ticker.json
mongoexport -h ds151232.mlab.com:51232 -d heroku_2frz56zq -c eth-usd-ticker -u heroku_2frz56zq -p dlpne93p29659v6esqcne5unrp -o data/eth-usd-ticker.json

# import data # mongoimport -h ds151232.mlab.com:51232 -d heroku_2frz56zq -c <collection> -u <user> -p <password> --file <input file>

mongoimport -d crybackup2 -c eth-usd-ticker --file data/eth-usd-ticker.json
mongoimport -d crybackup2 -c gdax.eth-usd-months --file data/eth-usd-months.json
mongoimport -d crybackup2 -c gdax.eth-usd-weeks --file data/eth-usd-weeks.json
mongoimport -d crybackup2 -c gdax.eth-usd-days --file data/eth-usd-days.json
mongoimport -d crybackup2 -c gdax.eth-usd-hours --file data/eth-usd-hours.json
mongoimport -d crybackup2 -c gdax.eth-usd-minutes --file data/eth-usd-minutes.json

mongoimport -d crybackup2 -c gdax.btc-usd-months --file data/btc-usd-months.json
mongoimport -d crybackup2 -c gdax.btc-usd-weeks --file data/btc-usd-weeks.json
mongoimport -d crybackup2 -c gdax.btc-usd-days --file data/btc-usd-days.json
mongoimport -d crybackup2 -c gdax.btc-usd-hours --file data/btc-usd-hours.json
mongoimport -d crybackup2 -c gdax.btc-usd-minutes --file data/btc-usd-minutes.json

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

## Getting OHLC

```js
// without ID
db.getCollection('btc-usd-days').aggregate({$sort:{_id: -1}}, {$project: {_id: 0, values: 0}}, {$limit: 30});

// with ID
db.getCollection('btc-usd-days').aggregate({$sort:{_id: -1}}, {$limit: 30}, {$project: {values: 0}});

// group by 7
const group = {$group: {
  _id: 1,
  open: { $first: '$open' },
  close: { $last: '$close' },
  high: { $max: '$high' },
  low: { $min: '$low' },
  sold: { $sum: '$sold' },
  bought: { $sum: '$bought' },
  volume: { $sum: '$volume' },
  count: { $sum: '$count' },
  times: { $push: '$time' }
}};

// {$project: {values: 0}}
var addGroupId = {$project: {
  groupId: { $sum: 1 }
}};

var noValues = {$project: {
  values: 0
}}

db.getCollection('btc-usd-days').aggregate({$sort:{_id: -1}}, {$limit: 28}, noValues);
```

# Consolidating data

## move data from one to another
mongoexport -d crybackup -c eth-usd-months -o data/eth-usd-months.json && mongoimport -d crybackup -c gdax.eth-usd-months --file data/eth-usd-months.json

## Consolidate joint data

```js
// doesn't work for minutes!!
var name = 'gdax.btc-usd-months';

var sortAsc = {$sort: {_id: 1}};

var groupByTime = {$group: {
    _id: '$time',
    id: {$first: '$_id'},
    high: {$max: '$high'},
    low: {$min: '$low'},
    open: {$first: '$open'},
    close: {$last: '$close'},
    volume: {$sum: '$volume'},
    sold: {$sum: '$sold'},
    bought: {$sum: '$bought'},
    count: {$sum: '$count'},
    valuesOpen: {$first: '$values.open'},
    valuesClose: {$last: '$values.close'},
//     values: {$addToSet: {open: {$first: '$values.open'}, close: {$last: '$values.close'} }}
//     'values.open': {$first: '$values.open'},
//     'values.close': {$last: '$values.close'}
}};

var joinValues = {$addFields: {
    time: '$_id',
    _id: '$id',
    values: {
        open: '$valuesOpen',
        close: '$valuesClose'
    }
}};

var removeTempVars = {$project: {
    valuesOpen: 0, valuesClose: 0, id: 0
}}

var newName = name + '-fixed';
var writeResults = {$out: newName};
db.getCollection(name).aggregate(sortAsc, groupByTime, joinValues, removeTempVars, writeResults);
db.getCollection(name).find({}).sort({_id: 1});
db.getCollection(newName).find({}).sort({_id: 1});
```

## Minutes consolidation

```js
// Only minutes! Requires mongod v3.5.6+ because of $mergeObjects https://github.com/mongodb/mongo/commit/896687b8ae6b7f848da88c7186a44bf3163c2254
var name = 'gdax.eth-usd-minutes';

var sortAsc = {$sort: {_id: 1}};

var groupByTime = {$group: {
    _id: '$time',
    id: {$first: '$_id'},
    high: {$max: '$high'},
    low: {$min: '$low'},
    open: {$first: '$open'},
    close: {$last: '$close'},
    volume: {$sum: '$volume'},
    sold: {$sum: '$sold'},
    bought: {$sum: '$bought'},
    count: {$sum: '$count'},
    values: {$mergeObjects: '$values'}
}};

var joinValues = {$addFields: {
    time: '$_id',
    _id: '$id'
}};

var removeTempVars = {$project: {
    id: 0
}}

var newName = name + '-fixed';
var writeResults = {$out: newName};
db.getCollection(name).aggregate([sortAsc, groupByTime, joinValues, removeTempVars, writeResults], {allowDiskUse: true});
db.getCollection(name).find({}).sort({_id: 1});
db.getCollection(newName).find({}).sort({_id: 1});
```


## merging data

```js
mongodump -d crybackup3 -o data/crybot3/
mongodump -d crybackup2 -o data/crybot2/

// insert data 2 in data 3
mongorestore -d crybackup3 data/crybackup2


mongodump -d crybackup3 -o data/backups/
mongorestore -h 165.227.113.186:27017 -u cryuser -p pass-mongodb-1gb-nyc3-01 -d crydb data/backups/crybackup3/

// make a final backup
mongodump -h 165.227.113.186:27017 -u cryuser -p pass-mongodb-1gb-nyc3-01 -d crydb -o data/backups/
// load the backup locally
mongorestore -d crybackup data/backups/crydb
```

# Grouping

```
// last 7 days groups
var resolution = 'days';
var multiplier = 7;
var limit = 100;

var descOrder = {$sort: {_id: -1}};
var ascOrder = {$sort: {_id: 1}};
var limit = {$limit: limit};
var toArray = {$group: {
    _id: null,
    data: {$push: '$$ROOT'}
}}
var addOrdinal = {$unwind: {
    path: '$data',
    includeArrayIndex: 'sequence'
}}
var addGroupId = {$addFields: {
    groupId: {$subtract: ['$sequence', {$mod: ['$sequence', multiplier]}]}
}}
var aggregateData = {$group: {
    _id: '$groupId',
    id: {$first: '$data._id'},
    open: { $first: '$data.open' },
    close: { $last: '$data.close' },
    high: { $max: '$data.high' },
    low: { $min: '$data.low' },
    volume: { $sum: '$data.volume' },
    sold: {$sum: '$data.sold'},
    bought: {$sum: '$data.bought'},
    count: {$sum: '$data.count'},
//     times: {$push: '$data.time'},
    timestamp: {$first: '$data.values.open.time'},
    n: {$sum: 1},
//     valuesOpen: {$first: '$data.values.open'},
//     valuesClose: {$last: '$data.values.close'}
}}

db.getCollection('gdax.btc-usd-' + resolution).aggregate(descOrder, limit)
db.getCollection('gdax.btc-usd-' + resolution).aggregate(descOrder, limit, toArray, addOrdinal, addGroupId, aggregateData, ascOrder);
```



```js
var collection = 'gdax.btc-usd-minutes';
var newCollection = collection + '-test2';

var limit = {$limit: 1};

var convertValuesObjToArray = {$addFields: {
    ticks: {$map: {input: {$objectToArray: '$values'}, as: 'tick', in: '$$tick.v'}}
}}

var removeValues = {$project:{values: 0}}

var addTicks ={$addFields: {
    openTick: { $arrayElemAt: ['$ticks', 0] },
    closeTick: { $arrayElemAt: ['$ticks', -1] },
}}

var addTimestamp = {$addFields: { week: {$literal: '$_id'} }}

var out = {$out: newCollection}

// db.getCollection(collection).aggregate([limit, convertValuesObjToArray, removeValues, addTicks, addTimestamp])
db.getCollection(collection).aggregate([limit, convertValuesObjToArray, removeValues, addTicks, addTimestamp, out])

db.getCollection(newCollection).find({}).forEach(d => {
    const ts = ISODate(d.openTick.time);
    ts.setMilliseconds(0);
    ts.setSeconds(0);

    db.getCollection(newCollection).update(d, {$set: {timestamp: ts}});
});

var addWeek = {$addFields: {week: {$week: '$timestamp'}, year: {$year: '$timestamp'} }}
var remove = {$project: {time: 0}}
db.getCollection(newCollection).aggregate([addWeek, remove, out]);

db.getCollection(newCollection).find({});

```


Get tickets
```js
var timeFilter = {$match: {timestamp: {$gte: ISODate("2017-09-28T21:58:00.000Z"), $lt: ISODate("2017-09-28T22:00:00.000Z") }}}
var onlyTicks = {$project: {ticks: 1, _id: 0}};
var array = {$unwind: '$ticks'};
db.getCollection('gdax.ltc-usd-minutes-1').aggregate([timeFilter, onlyTicks, array])
```