const { SCHEMA_VERSION, STORAGE_KEYS } = require('../utils/constants');

function readJson(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    if (v === '' || v === undefined || v === null) return fallback;
    return v;
  } catch (e) {
    console.error('[localStore] read failed', key, e);
    return fallback;
  }
}

function writeJson(key, value) {
  wx.setStorageSync(key, value);
}

function loadAll() {
  const meta = readJson(STORAGE_KEYS.meta, null);
  return {
    schemaVersion: (meta && meta.schemaVersion) || SCHEMA_VERSION,
    regions: readJson(STORAGE_KEYS.regions, []) || [],
    malls: readJson(STORAGE_KEYS.malls, []) || [],
    places: readJson(STORAGE_KEYS.places, []) || [],
    dishes: readJson(STORAGE_KEYS.dishes, []) || [],
    orders: readJson(STORAGE_KEYS.orders, []) || [],
    wishes: readJson(STORAGE_KEYS.wishes, []) || []
  };
}

function saveMeta(schemaVersion) {
  writeJson(STORAGE_KEYS.meta, {
    schemaVersion: schemaVersion || SCHEMA_VERSION,
    updatedAt: Date.now()
  });
}

function saveRegions(list) {
  writeJson(STORAGE_KEYS.regions, list || []);
  saveMeta();
}

function saveMalls(list) {
  writeJson(STORAGE_KEYS.malls, list || []);
  saveMeta();
}

function savePlaces(list) {
  writeJson(STORAGE_KEYS.places, list || []);
  saveMeta();
}

function saveDishes(list) {
  writeJson(STORAGE_KEYS.dishes, list || []);
  saveMeta();
}

function saveOrders(list) {
  writeJson(STORAGE_KEYS.orders, list || []);
  saveMeta();
}

function saveWishes(list) {
  writeJson(STORAGE_KEYS.wishes, list || []);
  saveMeta();
}

function saveAll(data) {
  writeJson(STORAGE_KEYS.regions, data.regions || []);
  writeJson(STORAGE_KEYS.malls, data.malls || []);
  writeJson(STORAGE_KEYS.places, data.places || []);
  writeJson(STORAGE_KEYS.dishes, data.dishes || []);
  writeJson(STORAGE_KEYS.orders, data.orders || []);
  writeJson(STORAGE_KEYS.wishes, data.wishes || []);
  saveMeta(data.schemaVersion || SCHEMA_VERSION);
}

function clearAll() {
  Object.keys(STORAGE_KEYS).forEach((k) => {
    try {
      wx.removeStorageSync(STORAGE_KEYS[k]);
    } catch (e) {
      // ignore
    }
  });
}

module.exports = {
  loadAll,
  saveAll,
  saveRegions,
  saveMalls,
  savePlaces,
  saveDishes,
  saveOrders,
  saveWishes,
  saveMeta,
  clearAll,
  readJson,
  writeJson
};
