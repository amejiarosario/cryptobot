function ticker(providers) {
  // connect to provider
  providers.forEach((provider) => {
    const {get, productIds, callback} = provider;
    get.ticker(callback, productIds);
  });
}

module.exports = ticker;