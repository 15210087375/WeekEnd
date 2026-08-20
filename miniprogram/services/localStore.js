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
    wishes: readJson(STORAGE_KEYS.wishes, []) || [],
    cinemas: readJson(STORAGE_KEYS.cinemas, []) || [],
    cinemaHalls: readJson(STORAGE_KEYS.cinemaHalls, []) || [],
    moviePlans: readJson(STORAGE_KEYS.moviePlans, []) || [],
    movieLogs: readJson(STORAGE_KEYS.movieLogs, []) || [],
    shopLogs: readJson(STORAGE_KEYS.shopLogs, []) || [],
    notes: readJson(STORAGE_KEYS.notes, []) || [],
    schedules: readJson(STORAGE_KEYS.schedules, []) || []
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

function saveShopLogs(list) {
  writeJson(STORAGE_KEYS.shopLogs, list || []);
  saveMeta();
}

function saveNotes(list) {
  writeJson(STORAGE_KEYS.notes, list || []);
  saveMeta();
}

function saveSchedules(list) {
  writeJson(STORAGE_KEYS.schedules, list || []);
  saveMeta();
}

function saveCinemas(cinemas, halls, moviePlans, movieLogs) {
  writeJson(STORAGE_KEYS.cinemas, cinemas || []);
  writeJson(STORAGE_KEYS.cinemaHalls, halls || []);
  writeJson(STORAGE_KEYS.moviePlans, moviePlans || []);
  writeJson(STORAGE_KEYS.movieLogs, movieLogs || []);
  saveMeta();
}

function saveAll(data) {
  writeJson(STORAGE_KEYS.regions, data.regions || []);
  writeJson(STORAGE_KEYS.malls, data.malls || []);
  writeJson(STORAGE_KEYS.places, data.places || []);
  writeJson(STORAGE_KEYS.dishes, data.dishes || []);
  writeJson(STORAGE_KEYS.orders, data.orders || []);
  writeJson(STORAGE_KEYS.wishes, data.wishes || []);
  writeJson(STORAGE_KEYS.cinemas, data.cinemas || []);
  writeJson(STORAGE_KEYS.cinemaHalls, data.cinemaHalls || []);
  writeJson(STORAGE_KEYS.moviePlans, data.moviePlans || []);
  writeJson(STORAGE_KEYS.movieLogs, data.movieLogs || []);
  writeJson(STORAGE_KEYS.shopLogs, data.shopLogs || []);
  writeJson(STORAGE_KEYS.notes, data.notes || []);
  writeJson(STORAGE_KEYS.schedules, data.schedules || []);
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
  saveCinemas,
  saveShopLogs,
  saveNotes,
  saveSchedules,
  saveMeta,
  clearAll,
  readJson,
  writeJson
};
