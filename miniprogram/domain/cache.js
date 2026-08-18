/**
 * 内存缓存 + 与 LocalStore 同步（领域层共享状态）
 */
const localStore = require('../services/localStore');
const { SCHEMA_VERSION } = require('../utils/constants');
const { normalizeCategory } = require('../config/categories');
const { scaleLegacy5to10 } = require('../utils/score');

let cache = null;

function migrateScoresTo10(data) {
  if ((data.schemaVersion || 0) >= 3) return false;
  (data.dishes || []).forEach((d) => {
    if (d.score != null) d.score = scaleLegacy5to10(d.score);
  });
  (data.wishes || []).forEach((w) => {
    if (w.wantScore != null) w.wantScore = scaleLegacy5to10(w.wantScore);
    if (w.doneScore != null) w.doneScore = scaleLegacy5to10(w.doneScore);
  });
  (data.movieLogs || []).forEach((row) => {
    if (row.score != null) row.score = scaleLegacy5to10(row.score);
  });
  data.schemaVersion = 3;
  return true;
}

function ensure() {
  if (!cache) {
    cache = localStore.loadAll();
    if (!cache.schemaVersion) cache.schemaVersion = SCHEMA_VERSION;
    if (!Array.isArray(cache.orders)) cache.orders = [];
    if (!Array.isArray(cache.wishes)) cache.wishes = [];
    if (!Array.isArray(cache.cinemas)) cache.cinemas = [];
    if (!Array.isArray(cache.cinemaHalls)) cache.cinemaHalls = [];
    if (!Array.isArray(cache.moviePlans)) cache.moviePlans = [];
    if (!Array.isArray(cache.movieLogs)) cache.movieLogs = [];
    if (!Array.isArray(cache.shopLogs)) cache.shopLogs = [];
    if (!Array.isArray(cache.notes)) cache.notes = [];
    // 旧数据：无 category / 旧 id 时规范化
    (cache.dishes || []).forEach((d) => {
      d.category = normalizeCategory(d.category);
    });
    if (migrateScoresTo10(cache)) {
      localStore.saveAll(cache);
    }
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

function persistCinemas() {
  const c = ensure();
  localStore.saveCinemas(c.cinemas, c.cinemaHalls, c.moviePlans, c.movieLogs);
}

function persistShopLogs() {
  localStore.saveShopLogs(ensure().shopLogs);
}

function persistNotes() {
  localStore.saveNotes(ensure().notes);
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
  persistCinemas,
  persistShopLogs,
  persistNotes,
  persistAll
};
