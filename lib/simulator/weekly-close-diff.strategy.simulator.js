/**
 * - Delete all data from DB (crytest)
 * - Start up mock services (provider's WSS, API)
 * - Run all the processes from the Procfile (analyzer, ticker)
 * - WSS is a replay of db crybackup on a given time range
 * - Assume every trade get charge the taker fee (0.26%)
 * - Check that P&L was good (5x), number of trades is not excesive.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { spawn } = require('child_process');

const mongo = require('../../lib/ticker/db');
const GdaxWebsocketMock = require('../../test/e2e/gdax.websocket.mock');
const GdaxHttpMock = require('../../test/e2e/gdax.http.mock');

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;

// const TIMEOUT = 10 * MINUTES;
const TIMEOUT = 10 * SECONDS;
const START = 'MAR-2017';
const END = 'OCT-2017'; // 300% ^

describe('Weekly close diff strategy simulator', function () {
  this.timeout(TIMEOUT);
  let wss, https, apps;

  beforeEach(done => {
    // Delete all data from DB (crytest)
    mongo.deleteDb()
      .then(() => done())
      .catch(done);
  });

  beforeEach(done => {
    // Start up mock services (provider's WSS)
    wss = new GdaxWebsocketMock();
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

    apps = spawn('npm', ['run', 'heroku'], { detached: true});

    console.log(`Spawned child pid: ${apps.pid}`);

    apps.stdout.on('data', data => {
      console.log(`stdout: ${data}`);
      output.push(data);
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
      console.log(`child process exited with code ${code}`);
      done();
    });

    // process.kill(-apps.pid, 'SIGTERM'); // Heroku:  Stopping all processes with SIGTERM
    process.kill(-apps.pid, 'SIGINT'); // Nicer finish
    // process.kill(-apps.pid);
    // process.kill(apps.pid); // not working
    // apps.kill(); // doesn't work either http://azimi.me/2014/12/31/kill-child_process-node-js.html
  });

  after(() => {
    wss.close();
  });

  after(() => {
    https.close();
  });

  it('should generate profit 5x', () => {
    // WSS is a replay of db crybackup on a given time range
    // Assume every trade get charge the taker fee (0.26%)
    // Check that P&L was good (5x), number of trades is not excesive.
  });
});