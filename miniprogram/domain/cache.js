/**
 * 内存缓存 + 与 LocalStore 同步（领域层共享状态）
 */
const localStore = require('../services/localStore');
const { SCHEMA_VERSION } = require('../utils/constants');
const { normalizeCategory } = require('../config/categories');
const { scaleLegacy5to10 } = require('../utils/score');
const { uuid } = require('../utils/id');

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

function brandGroupKey(p) {
  const brand = String((p && p.brandName) || '').trim().toLowerCase();
  const virt = p && p.isVirtual ? 'v' : 'p';
  return `${virt}:${brand || p.id}`;
}

function placeToBranch(p, index) {
  const name =
    String((p && p.storeName) || '').trim() ||
    String((p && p.address) || '').trim().slice(0, 16) ||
    `分店${index + 1}`;
  return {
    id: p.id || uuid(),
    name,
    regionId: p.regionId || '',
    mallId: p.mallId || null,
    address: p.address || '',
    navUrl: p.navUrl || '',
    note: p.note || ''
  };
}

/** schema 4：同一品牌多条 Place 收成一家，分店进 branches，菜只挂店 */
function migratePlacesToBrand(data) {
  if ((data.schemaVersion || 0) >= 4) return false;
  const places = Array.isArray(data.places) ? data.places : [];
  const groups = {};
  const order = [];
  places.forEach((p) => {
    if (!p || !p.id) return;
    const key = brandGroupKey(p);
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(p);
  });
  const keep = [];
  const idMap = {};
  order.forEach((key) => {
    const list = groups[key]
      .slice()
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const main = { ...list[0] };
    const existing = Array.isArray(main.branches) ? main.branches.slice() : [];
    if (list.length > 1) {
      list.forEach((p, i) => {
        idMap[p.id] = main.id;
        const branch = placeToBranch(p, i);
        if (!existing.some((b) => b && b.id === branch.id)) existing.push(branch);
      });
      main.storeName = '';
      main.branches = existing;
    } else {
      idMap[main.id] = main.id;
      main.branches = existing;
    }
    keep.push(main);
  });
  data.places = keep;
  (data.dishes || []).forEach((d) => {
    if (d && d.placeId && idMap[d.placeId]) d.placeId = idMap[d.placeId];
  });
  data.schemaVersion = 4;
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
    if (!Array.isArray(cache.schedules)) cache.schedules = [];
    // 旧数据：无 category / 旧 id 时规范化
    (cache.dishes || []).forEach((d) => {
      d.category = normalizeCategory(d.category);
    });
    let migrated = false;
    if (migrateScoresTo10(cache)) migrated = true;
    if (migratePlacesToBrand(cache)) migrated = true;
    if (migrated) {
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

function persistSchedules() {
  localStore.saveSchedules(ensure().schedules);
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
  persistSchedules,
  persistAll
};
