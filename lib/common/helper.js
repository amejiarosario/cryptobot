const chalk = require('chalk');
const debug = require('debug')('crybot:helper');

function callback(err, response, data) {
  if (err) {
    console.error(chalk.red(err));
    console.error(new Error(err));
  }

  if (response && response.statusCode !== 200) {
    debug(chalk.blue(`Status code: ${response.statusCode}`));
  }

  debug(chalk.green(JSON.stringify(data, null, 2)));
}

module.exports = {
  callback
};