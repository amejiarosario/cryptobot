const { MongoClient } = require('mongodb');

const DEBUG = false;

const VERSION = 1;
const DATABASES = ['mongodb://localhost:27017/cryrecover'];
const PAIRS = ['gdax.ltc-usd', 'gdax.eth-usd', 'gdax.btc-usd'];
const TIMEFRAMES = ['minutes', 'hours', 'days', 'weeks', 'months'];

runMigration({
  version: VERSION,
  databases: DATABASES,
  pairs: PAIRS,
  timeframes: TIMEFRAMES,
  collectionFn
}).then(() => {
  console.log('done!');
}).catch(error => {throw error});

async function runMigration({version, databases, pairs, timeframes, collectionFn}) {
  const collections = pairs.map(p => timeframes.map((t, i) => `${p}-${i}-${t}-v${version}`)).reduce((a, e) => a.concat(e), []);
  const results = [];

  for(const name of collections) {
    for (const uri of databases) {
      const db = await MongoClient.connect(uri);
      const result = await collectionFn(db, name);
      results.push(result);
      db.close();
    }
  }

}

async function collectionFn(db, name) {
  const collection = db.collection(name);

  const group = {$group: {
    _id: { year: { $year:'$timestamp'},
      week: { $week:'$timestamp'},
      month: { $month:'$timestamp'},
      day: { $day:'$timestamp'},
      hour: { $hour:'$timestamp'},
      minute: { $minute:'$timestamp'}
    },
    timestamp: { $first: '$timestamp' },
    open: { $first: '$price' },
    close: { $last: '$price' },
    high: { $max: '$price' },
    low: { $min: '$price' },
    sold: { $sum: '$sold' },
    bought: { $sum: '$bought' },
    volume: { $sum: '$volume' }
  }};
  const out = {$out: `m-${name}`};

  const pipeline = [group, out];
  const cursor = collection.aggregate(pipeline, { allowDiskUse: true });
  return cursor.toArray();
}