# Commits
  🔨	`:hammer:` - Breaking change
  💡	`:bulb:` - New Feature
  🐛	`:bug:`  - Fixed Bug
  🔒	`:lock:` - Security Improvements

# next

  Break


  Features
  - [ ] Simulator results on graph and report
  - [ ] Trailing orders supports base and quote (keep amount) parameters on trade. E.g. I can say how much BTC I want to buy.
  - [ ] Use Orderbook to always be the MAKER on trades
  - [ ] Authenticate on the websocket feed to get my matched orders
  - [ ] Save funds on db. Before trades are made funds are updated save those and get them on reload

  Bugs
  - [ ] Trading Orders don't update correctly. E.g. status from open to cancel doesn't work and sometimes internal values (trigger.buy) are not updated until you restart
  - [ ] ticker.1: Error R14 (Memory quota exceeded)
      `web: node --optimize_for_size --max_old_space_size=460 server.js`
      https://devcenter.heroku.com/articles/node-memory-use
      https://blog.heroku.com/node-habits-2016#7-avoid-garbage
  - [ ] Handle graceful port shutdown when WSS is not connected yet: UnsubscriptionError: 1 errors occurred during unsubscription: 1) Error: Could not disconnect (not connected)

  Security:
  - [ ] logs db password: app/ticker.1:  crybot:db Databse:  mongodb://cryuser:pass-mongodb-1gb-nyc3-01@165.227.113.186:53562/crydb
  - [ ] docs has db passwords

# 4.0.1

  Bugs
  - [x] FIX: UnsubscriptionError: 1 errors occurred during unsubscription: 1) Error: Could not disconnect (not connected)

# 4.0.0
  Break:
  - [x] (migration-001) Weeks timestamp breaks when it has multiple months. e.g Aug/week35, Sep/week35

  Features:

  Bugs:
  - [x] Orders execute multiple times (maybe not updating done column?)
# 3.x

Features:
  - [x] Avoid buy fees! Add +/- 0.3% to order price. Taker fees: Gdax 0.25 %; Kraken 0.26%;  Poloniex 0.25%
  - [x] Cleanup trading logs (remove duplicates)

Bugs:
  - [x] If update the trailing and there's already a trigger, it doesn't get updated. But it can be reset manually passing trigger: {}
  - [x] When restarting in heroku the Websocket continues to listen rather than stopping.
  - [x] Cancelling an order can make them execute immdiately if trailing is not passed. Do not set orders (trailingOrders) if they are not open
  - [x] (low) Trigger events were logged multiple times. Because it didn't remove the listener
  - [x] Heroku reloads every 24h, so triggered trailing orders are lost when the system restart. Save trigger info to DB so when the app is reloaded it has the info.
  - [x] New orders through API (HTTP) clear old ones and they still persist in the DB. Either remove old orders in DB and add new ones OR reload orders after a save happens and update trailing orders. SOLUTION: Allow status to be changed through the API and be set to cancelled
