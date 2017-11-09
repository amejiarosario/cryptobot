/**
 * - Delete all data from DB (crytest)
 * - Start up mock services (provider's WSS, API)
 * - Run all the processes from the Procfile (analyzer, ticker)
 * - WSS is a replay of db crybackup on a given time range
 * - Assume every trade get charge the taker fee (0.26%)
 * - Check that P&L was good (5x), number of trades is not excesive.
 *
 * $ ps ax | grep rabbit | cut -d' ' -f1 | xargs kill -9; brew services restart rabbitmq; brew services list && rabbitmqadmin list queues
 * $ lsof -i -n -P | grep LISTEN | grep 5100 | awk 'NR==1 {print $2}' | xargs kill && npm run simulator
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { spawn } = require('child_process');

const mongo = require('../../lib/ticker/db');
const GdaxWebsocketMock = require('../../test/helpers/gdax.websocket.mock');
const GdaxHttpMock = require('../../test/helpers/gdax.http.mock');

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;

// const TIMEOUT = 10 * MINUTES;
// const TIMEOUT = 10 * SECONDS;
const TIMEOUT = 2 * MINUTES;

const START = 'MAR-2017';
const END = 'OCT-2017'; // 300% ^

describe('Weekly close diff strategy simulator', function () {
  this.timeout(TIMEOUT);
  let wss, https, apps;

  it('should generate profit 5x', done => {
    // WSS is a replay of db crybackup on a given time range
    // verify it generates ordes automatically
    // Assume every trade get charge the taker fee (0.26%)
    // Check that P&L was good (5x), number of trades is not excesive.

    //
    // Listen for console output
    //
    apps.stdout.on('data', data => {
      if(data) {
        console.log(`it.stdout: ${data.toString().replace(/^\s+|\s+$/g, '')}`); // replace remove new line
      }
    });
    apps.stderr.on('data', done);
    apps.on('close', code => done(`Process exited prematurely with code ${code}`));

    setTimeout(function () {
      apps.stdout.removeAllListeners();
      apps.stderr.removeAllListeners();
      apps.removeAllListeners();
      done();
    }, 5 * MINUTES);
  });

  // Test prep

  beforeEach(done => {
    // Delete all data from DB (crytest)
    mongo.deleteDb()
      .then(() => done())
      .catch(done);
  });

  beforeEach(done => {
    const timeFilter = { $match: { timestamp: {
      $gte: new Date("2017-07-10T00:00:00.000Z"),
      // $gte: new Date("2017-09-10T00:00:00.000Z"),
      $lt: new Date("2017-09-25T00:00:00.000Z") // only 14 days
    } } };
    const onlyTicks = { $project: { ticks: 1, _id: 0 } };
    const unwind = { $unwind: '$ticks' };

    // Start up mock services (provider's WSS)
    wss = new GdaxWebsocketMock({collection: {
      name: 'gdax.btc-usd-0-minutes-v2',
      dateFormat: 'YYYY-MM-DD 00:00:00.000', // by day
      pipeline: [timeFilter, onlyTicks, unwind],
      delay: 500 // delay sending ws messages
    }});
    wss.isConnected().then(() => done());
  });

  beforeEach(done => {
    // Start up mock services (provider's API)
    https = new GdaxHttpMock();
    https.isConnected().then(() => done());
  });

  beforeEach(done => {
    // Run all the processes from the Procfile (analyzer, ticker)
    const output = [];

    const env = Object.create(process.env);
    env.ENV = 'simulation';
    env.DEBUG = 'crybot:*';
    env.DEBUG_DEPTH = 6;
    env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

    console.log('env', env);

    apps = spawn('npm', ['run', 'heroku'], { env: env }); // , { detached: true}

    console.log(`Spawned child pid: ${apps.pid}`);

    apps.stdout.on('data', data => {
      if (data) {
        console.log(`beforeEach.stdout: ${data.toString().replace(/^\s+|\s+$/g, '')}`); // replace remove new line
        output.push(data);
      }
    });

    apps.stderr.on('data', done);

    apps.on('close', code => done(`Process exited prematurely with code ${code}`));

    setTimeout(function() {
      if(output.length > 0) {
        apps.stdout.removeAllListeners();
        apps.stderr.removeAllListeners();
        apps.removeAllListeners();
        done();
      } else {
        done(`No output found`);
      }
    }, 2 * SECONDS);
  });

  after(done => {
    console.log('Closing app...');

    apps.stdout.on('data', data => {
      console.log(`stdout*: ${data}`);
    });

    apps.stderr.on('data', data => {
      console.log(`stderr*: ${data}`);
    });

    apps.on('close', code => {
      // console.log(`child process exited with code ${code}`);
      done(`Process exited prematurely ${code}`);
    });

    apps.on('exit', (code, signal) => {
      console.log(`child process exited with code ${code} ${signal}`);
      done();
    });

    // process.kill(-apps.pid, 'SIGINT'); // Nicer finish // requires { detached: true}

    // process.kill(-apps.pid, 'SIGTERM'); // Heroku:  Stopping all processes with SIGTERM
    // process.kill(-apps.pid);
    // process.kill(apps.pid); // not working
    apps.kill(); // doesn't work alone http://azimi.me/2014/12/31/kill-child_process-node-js.html
  });

  after(() => {
    wss.close();
  });

  after(() => {
    https.close();
  });
});