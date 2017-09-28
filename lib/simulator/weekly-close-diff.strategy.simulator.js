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

const MINUTES = 1000 * 60;
const TIMEOUT = 10 * MINUTES;
const START = 'MAR-2017';
const END = 'OCT-2017'; // 300% ^

describe('Weekly close diff strategy simulator', function () {
  this.timeout(TIMEOUT);

  beforeEach(() => {
    // Delete all data from DB (crytest)
  });

  beforeEach(() => {
    // Start up mock services (provider's API)
  });

  beforeEach(() => {
    // Start up mock services (provider's WSS)
  });

  beforeEach(() => {
    // Run all the processes from the Procfile (analyzer, ticker)
  });


  it('should generate profit 5x', () => {
    // WSS is a replay of db crybackup on a given time range
    // Assume every trade get charge the taker fee (0.26%)
    // Check that P&L was good (5x), number of trades is not excesive.
  });

});