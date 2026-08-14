const cache = require('./cache');
const { DISH_KIND } = require('../utils/constants');

function getStats() {
  const c = cache.ensure();
  return {
    regionCount: c.regions.length,
    mallCount: c.malls.length,
    placeCount: c.places.length,
    dishCount: c.dishes.length,
    dineOutCount: c.dishes.filter((d) => d.kind === DISH_KIND.DINE_OUT).length,
    homemadeCount: c.dishes.filter((d) => d.kind === DISH_KIND.HOMEMADE).length
  };
}

module.exports = { getStats };
