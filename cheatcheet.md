# Heroku

https://devcenter.heroku.com/articles/deploying-nodejs

Most used commands:

```s
# create
heroku create crybot

# test locally
heroku local worker
heroku local web

# pushing code
git push heroku master

# Avoid being killed after not biding to $PORT (non-web apps)
heroku scale web=0 worker=1

# logs
heroku logs -t

# free hours left
heroku ps -a crybot

# enabling metrics on logs
heroku labs:enable log-runtime-metrics
heroku restart

# get data backup
mongoexport -h ds151232.mlab.com:51232 -d heroku_2frz56zq -c btc-usd-ticker -u heroku_2frz56zq -p dlpne93p29659v6esqcne5unrp -o btc-usd-ticker.json

# import data # mongoimport -h ds151232.mlab.com:51232 -d heroku_2frz56zq -c <collection> -u <user> -p <password> --file <input file>
mongoimport -h localhost:27017 -d localbot2 -c btc-usd-ticker --file btc-usd-ticker.json
```

# Switching to OpenShift?

http://givemethechills.com/how-to-migrate-a-node-js-app-from-heroku-to-openshift/

