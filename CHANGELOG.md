# 3.0.0

Issues:
  - New orders through API (HTTP) clear old ones and they still persist in the DB. Either remove old orders in DB and add new ones OR reload orders after a save happens and update trailing orders
  - Heroku reloads every 24h, so triggered trailing orders are lost when the system restart