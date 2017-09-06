# 3.0.x

Features:
  - [ ] Avoid buy fees! Options: 1) Add +/- 0.3% to order price. Taker fees: Gdax 0.25 %; Kraken 0.26%;  Poloniex 0.25%
  - [ ] Cleanup trading logs (remove duplicates)
  - [ ] Save funds on db. Before trades are made funds are updated save those and get them on reload

Issues:
  - [ ] When restarting in heroku the Websocket continues to listen rather than stopping.
  - [x] Cancelling an order can make them execute immdiately if trailing is not passed. Do not set orders (trailingOrders) if they are not open
  - [x] (low) Trigger events were logged multiple times. Because it didn't remove the listener
  - [x] Heroku reloads every 24h, so triggered trailing orders are lost when the system restart. Save trigger info to DB so when the app is reloaded it has the info.
  - [x] New orders through API (HTTP) clear old ones and they still persist in the DB. Either remove old orders in DB and add new ones OR reload orders after a save happens and update trailing orders. SOLUTION: Allow status to be changed through the API and be set to cancelled



  Sep 02 23:26:25 crybot app/worker.1: crybot:amqp Server::Replied: '{"gdax.BTC-USD":[{"side":"buy","target":3800,"trailing":{"amount":25},"trade":{"percentage":1}},{"side":"buy","target":4000,"trailing":{"amount":50},"trade":{"percentage":0.8}},{"side":"buy","target":4700,"status":"cancelled"}],"gdax.ETH-USD":[{"side":"buy","target":290,"trailing":{"amount":10},"trade":{"percentage":0.3}},{"side":"buy","target":210,"trailing":{"amount":20},"trade":{"percentage":0.8}}]}'
Sep 02 23:26:25 crybot app/worker.1: crybot:db Orders operation saved { nUpserted: 0, modifiedCount: 1 }
Sep 02 23:26:25 crybot app/worker.1: crybot:db Updating order { nUpserted: undefined, modifiedCount: 0 }
Sep 02 23:26:32 crybot app/worker.1: crybot:trailling-order [TRADING] Trigger price met: { buy: { price: 4670.81, trail: 4670.81 } } -- 4670.81
Sep 02 23:26:32 crybot app/worker.1: Error with trailing order:  Error executing trade. statusCode=400 error={"message":"Insufficient funds"}. Trade {"order":{"side":"buy","target":4700,"status":"cancelled"},"trade":{"side":"buy","size":0.72894796,"price":4670.81,"product_id":"BTC-USD"}}
Sep 02 23:26:32 crybot app/worker.1: crybot:ticker [Logger] Error: 'Error executing trade. statusCode=400 error={"message":"Insufficient funds"}. Trade {"order":{"side":"buy","target":4700,"status":"cancelled"},"trade":{"side":"buy","size":0.72894796,"price":4670.81,"product_id":"BTC-USD"}}'
Sep 02 23:26:32 crybot app/worker.1: /app/node_modules/rxjs/Subscriber.js:242
Sep 02 23:26:32 crybot app/worker.1:             throw err;
Sep 02 23:26:32 crybot app/worker.1:             ^
Sep 02 23:26:32 crybot app/worker.1: Error executing trade. statusCode=400 error={"message":"Insufficient funds"}. Trade {"order":{"side":"buy","target":4700,"status":"cancelled"},"trade":{"side":"buy","size":0.72894796,"price":4670.81,"product_id":"BTC-USD"}}
Sep 02 23:26:32 crybot app/worker.1: crybot:trailling-order Funds updated { base: 0.70468666, quote: 3404.7774 }
Sep 02 23:26:32 crybot app/worker.1: crybot:trailling-order [TRADING] Executing trade for BTC-USD buy @ 4700 - Trade: { side: 'buy', size: 0.72894796, price: 4670.81, product_id: 'BTC-USD' }
Sep 02 23:26:32 crybot app/worker.1: crybot:gdax executing GDAX order: { side: 'buy', size: 0.72894796, price: 4670.81, product_id: 'BTC-USD' }