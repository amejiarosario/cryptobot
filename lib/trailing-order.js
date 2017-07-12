class TrailingOrder {
  funds(value) {
    this.funds = value;
  }

  limits(value) {
    this.limits = value;
  }

  /**
   * Set current price
   * @param {Float} value current price value
   */
  ticker(value) {
    this.current = parseFloat(value);
    this.checkLimits();
  }

  /**
   * Check if current price has gone off limits and execute associated action
   */
  checkLimits() {
    if(this.current <= this.limits.lte.price) {
      this.limits.lte.action.callback({
        side: 'buy',
        price: 1717,
        size: 0.05824112        
      });
    }
  }

}

module.exports = TrailingOrder;