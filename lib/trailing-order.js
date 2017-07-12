class TrailingOrder {
  funds(value) {
    this.funds = value;
  }

  /**
   * 
   * @param {Object} value - object with all the limit triggers and actions
   */
  limits(value) {
    this.limits = value;
  }

  /**
   * Set current price
   * @param {Float} value current price value
   */
  ticker(value) {
    this.last = parseFloat(value);
    this.checkLimits(this.last);
  }

  /**
   * Check if current price has gone off limits and execute associated action
   */
  checkLimits(current) {
    if (this.limits.buy) {
      const { price: buyPrice, trailing: buyTrailing, action: buyAction } = this.limits.buy;
      this.newBuyTrail = this.newBuyTrail || buyPrice;

      if (current <= this.newBuyTrail) {
        this.buyingPrice = current * (1 + buyTrailing);
        this.newBuyTrail = current * (1 - buyTrailing);
      } else if (this.buyingPrice && current >= this.buyingPrice) {
        buyAction({
          side: 'buy',
          price: 1717,
          size: 0.05824112
        });
      }      
    }

    // selling
    if (this.limits.sell) {
      const { price: sellPrice, trailing: sellTrailing, action: sellAction } = this.limits.sell;
      this.newSellTrail = this.newSellTrail || sellPrice;

      if (current >= this.newSellTrail) {
        this.sellingPrice = current * (1 + sellTrailing);
        this.newSellTrail = current * (1 - sellTrailing);
      } else if (this.sellingPrice && current <= this.sellingPrice) {
        sellAction({
          side: 'sell',
          price: 1717,
          size: 0.05824112
        });
      }      
    }
    // console.log(current, JSON.stringify(this));
  }

}

module.exports = TrailingOrder;