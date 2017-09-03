# 3.0.x

Features:
  - [ ] Save funds on db. Before trades are made funds are updated save those and get them on reload

Issues:
  - [ ] Cancelling an order can make them execute immdiately if trailing is not passed
  - [x] Heroku reloads every 24h, so triggered trailing orders are lost when the system restart. Save trigger info to DB so when the app is reloaded it has the info.
  - [x] New orders through API (HTTP) clear old ones and they still persist in the DB. Either remove old orders in DB and add new ones OR reload orders after a save happens and update trailing orders. SOLUTION: Allow status to be changed through the API and be set to cancelled