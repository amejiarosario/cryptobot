const chalk = require('chalk');

function callback(err, response, data) {
  if (err) {
    console.warn(chalk.red(err));
  }

  if (response && response.statusCode !== 200) {
    console.info(chalk.blue(`Status code: ${response.statusCode}`));
  }

  console.log(chalk.green(JSON.stringify(data, null, 2)));
}

module.exports = {
  callback
};