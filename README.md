# Cryptobot

:moneybag: :robot: Cryptocurrency trading bot for multiple platforms and coins (gdax/coinbase & dollar/bitcoin/ethereum/litecoin)

This is a multi-currency trading bot. It's primary purpose was to automate trading cryptocurrency, however it can be use to trade forex, stocks and index funds once you made the API integration.

# Strategies

There are multiple strategies and depending on what your goals are you might choose one of the following.

## Buy and hold

It's very hard to time the market even with automated tools like this. So, one strategy that can work for you is buying and holding. This espcially useful when you know the main trend is upward. Let's say you bet in the US market going up over the years. In that case, you can buy and hold. This will also avoid you trading fees, commisions and capital gains taxes (if applies).

## Buy low and sell high

This strategy applies for everything. However, it is specially useful when trading currencies. The market is very volatile so you want to ensure you buy to the lowest price and sell high. It's up to you to choose the time range when this is going to happen (1h, 1d, or 1y).

# Technical Analysis

Again there is a lot to choose from. So this bot uses a combination of multiple ones to give you the best results for your strategy.

# Notes

- CLI tool that runs in the background
- produces logs and also has a command colored logs stdout
- unit test for all functions
- every function is documented
- integration test to test strategies with real market data
- try to avoid takers side (market orders) and favor makers side (limit and stop orders)

# Questions

- How's price set on the market? If somebody set a sell price that is in the range of a buy order do both get matched even if the current market price hasn't reach that yet?


# Dependencies

```
npm install pm2 -g

pm2 start --name="ticker" ./cli.js -- ticker
pm2 ls
pm2 stop
```