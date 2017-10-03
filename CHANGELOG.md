# 4.x

Break
  - [ ] (migration-001) Weeks timestamp breaks when it has multiple months. e.g Aug/week35, Sep/week35

Features
  - [ ] Trailing orders supports base and quote (keep amount) parameters on trade. E.g. I can say how much BTC I want to buy.
  - [ ] Use Orderbook to always be the MAKER on trades
  - [ ] Authenticate on the websocket feed to get my matched orders
  - [ ] Save funds on db. Before trades are made funds are updated save those and get them on reload

Bugs:
  - [ ] Orders execute multiple times (maybe not updating done column?)

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
