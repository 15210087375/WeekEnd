/**
 * 内存缓存 + 与 LocalStore 同步（领域层共享状态）
 */
const localStore = require('../services/localStore');
const { SCHEMA_VERSION } = require('../utils/constants');
const { normalizeCategory } = require('../config/categories');

let cache = null;

function ensure() {
  if (!cache) {
    cache = localStore.loadAll();
    if (!cache.schemaVersion) cache.schemaVersion = SCHEMA_VERSION;
    if (!Array.isArray(cache.orders)) cache.orders = [];
    if (!Array.isArray(cache.wishes)) cache.wishes = [];
    // 旧数据：无 category / 旧 id 时规范化
    (cache.dishes || []).forEach((d) => {
      d.category = normalizeCategory(d.category);
    });
  }
  return cache;
}

function get() {
  return ensure();
}

function setAll(next) {
  cache = next;
}

function reload() {
  cache = localStore.loadAll();
  return cache;
}

function persistRegions() {
  localStore.saveRegions(ensure().regions);
}

function persistMalls() {
  localStore.saveMalls(ensure().malls);
}

function persistPlaces() {
  localStore.savePlaces(ensure().places);
}

function persistDishes() {
  localStore.saveDishes(ensure().dishes);
}

function persistOrders() {
  localStore.saveOrders(ensure().orders);
}

function persistWishes() {
  localStore.saveWishes(ensure().wishes);
}

function persistAll() {
  localStore.saveAll(ensure());
}

module.exports = {
  ensure,
  get,
  setAll,
  reload,
  persistRegions,
  persistMalls,
  persistPlaces,
  persistDishes,
  persistOrders,
  persistWishes,
  persistAll
};
