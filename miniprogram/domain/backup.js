/**
 * 导出 / 导入（与业务 CRUD 解耦）
 * 支持分模块：menu | orders | wishes | all
 */
const cache = require('./cache');
const imageStore = require('../services/imageStore');
const localStore = require('../services/localStore');
const { SCHEMA_VERSION, BACKUP_MODULES } = require('../utils/constants');
const { normalizeCategory } = require('../config/categories');
const { now, clone } = require('./helpers');

const ATOMIC = [BACKUP_MODULES.MENU, BACKUP_MODULES.ORDERS, BACKUP_MODULES.WISHES];

const MODULE_LABELS = {
  menu: '菜单',
  orders: '点餐',
  wishes: '心愿单',
  all: '全部'
};

function pushImages(images, ownerKey, ownerId, list) {
  (list || []).forEach((img, index) => {
    if (!img || !img.localPath) return;
    try {
      const base64 = imageStore.readBase64(img.localPath);
      const parts = img.localPath.split(/[/\\]/);
      const fileName = parts[parts.length - 1] || `${ownerId}_${index}.jpg`;
      const item = { index, fileName, base64 };
      item[ownerKey] = ownerId;
      images.push(item);
    } catch (e) {
      console.warn('[export] skip image', img.localPath, e);
    }
  });
}

function restoreImages(entityId, existingImages, imageItems, matchFn) {
  return (existingImages || []).map((img, index) => {
    const item = imageItems.find((x) => matchFn(x, index));
    if (item && item.base64) {
      try {
        const localPath = imageStore.writeBase64(
          entityId,
          item.fileName || `${index}.jpg`,
          item.base64
        );
        return { localPath };
      } catch (e) {
        console.warn('[import] write image failed', e);
        return img;
      }
    }
    return img;
  });
}

/**
 * 规范化模块列表：all → 三个原子模块；去重；非法忽略
 * @param {string[]|string|undefined} raw
 * @returns {string[]} 原子模块 id 列表（不含 all）
 */
function normalizeModules(raw) {
  let list = [];
  if (raw == null || raw === '') {
    list = [BACKUP_MODULES.ALL];
  } else if (typeof raw === 'string') {
    list = [raw];
  } else if (Array.isArray(raw)) {
    list = raw.slice();
  } else {
    list = [BACKUP_MODULES.ALL];
  }
  const set = {};
  list.forEach((m) => {
    const id = String(m || '').trim();
    if (!id) return;
    if (id === BACKUP_MODULES.ALL) {
      ATOMIC.forEach((a) => {
        set[a] = true;
      });
      return;
    }
    if (ATOMIC.indexOf(id) >= 0) set[id] = true;
  });
  const out = ATOMIC.filter((a) => set[a]);
  if (!out.length) {
    throw new Error('请至少选择一个备份模块');
  }
  return out;
}

function modulesLabel(modules) {
  const list = normalizeModules(modules);
  if (list.length === ATOMIC.length) return MODULE_LABELS.all;
  return list.map((m) => MODULE_LABELS[m] || m).join('、');
}

function hasModule(modules, id) {
  return normalizeModules(modules).indexOf(id) >= 0;
}

/**
 * @param {string[]|string} [modules] 默认全部
 */
function exportPackage(modules) {
  const selected = normalizeModules(modules == null ? BACKUP_MODULES.ALL : modules);
  const c = cache.ensure();
  const data = {};
  const images = [];

  if (hasModule(selected, BACKUP_MODULES.MENU)) {
    data.regions = clone(c.regions);
    data.malls = clone(c.malls);
    data.places = clone(c.places);
    data.dishes = clone(c.dishes);
    (data.dishes || []).forEach((dish) => {
      pushImages(images, 'dishId', dish.id, dish.images);
    });
  }
  if (hasModule(selected, BACKUP_MODULES.ORDERS)) {
    data.orders = clone(c.orders || []);
  }
  if (hasModule(selected, BACKUP_MODULES.WISHES)) {
    data.wishes = clone(c.wishes || []);
    (data.wishes || []).forEach((wish) => {
      pushImages(images, 'wishId', wish.id, wish.images);
    });
  }

  return {
    format: 'weekend-food-archive',
    version: 3,
    exportedAt: now(),
    modules: selected,
    data,
    images
  };
}

function resolveImportModules(pkg) {
  if (pkg.modules && (Array.isArray(pkg.modules) ? pkg.modules.length : true)) {
    return normalizeModules(pkg.modules);
  }
  // 旧包无 modules：视为全量
  return normalizeModules(BACKUP_MODULES.ALL);
}

/**
 * 按模块导入；未包含的模块保持本机不动
 * @returns {{ modules: string[], modulesLabel: string }}
 */
function importPackage(pkg) {
  if (!pkg || pkg.format !== 'weekend-food-archive') {
    throw new Error('不是有效的周末美食档案备份');
  }
  if (pkg.version !== 1 && pkg.version !== 2 && pkg.version !== 3) {
    throw new Error(`不支持的备份版本: ${pkg.version}`);
  }

  const selected = resolveImportModules(pkg);
  const data = pkg.data || {};
  const imageItems = Array.isArray(pkg.images) ? pkg.images : [];
  const cur = cache.ensure();

  let regions = cur.regions;
  let malls = cur.malls;
  let places = cur.places;
  let dishes = cur.dishes;
  let orders = cur.orders || [];
  let wishes = cur.wishes || [];

  if (hasModule(selected, BACKUP_MODULES.MENU)) {
    (cur.dishes || []).forEach((d) => imageStore.removeDishImages(d.images));
    regions = Array.isArray(data.regions) ? data.regions : [];
    malls = Array.isArray(data.malls) ? data.malls : [];
    places = Array.isArray(data.places) ? data.places : [];
    dishes = Array.isArray(data.dishes) ? clone(data.dishes) : [];
    dishes = dishes.map((dish) => {
      const images = restoreImages(dish.id, dish.images, imageItems, (x, index) => {
        return x.dishId === dish.id && x.index === index && !x.wishId;
      });
      dish.category = normalizeCategory(dish.category);
      return { ...dish, images };
    });
  }

  if (hasModule(selected, BACKUP_MODULES.ORDERS)) {
    orders = Array.isArray(data.orders) ? clone(data.orders) : [];
  }

  if (hasModule(selected, BACKUP_MODULES.WISHES)) {
    (cur.wishes || []).forEach((w) => imageStore.removeDishImages(w.images));
    wishes = Array.isArray(data.wishes) ? clone(data.wishes) : [];
    wishes = wishes.map((wish) => {
      const images = restoreImages(wish.id, wish.images, imageItems, (x, index) => {
        return x.wishId === wish.id && x.index === index;
      });
      if (!wish.status) wish.status = 'want';
      if (wish.priceRef === undefined) wish.priceRef = null;
      if (!Array.isArray(wish.images)) wish.images = [];
      if (!wish.visibility) wish.visibility = 'space';
      return { ...wish, images };
    });
  }

  const next = {
    schemaVersion: SCHEMA_VERSION,
    regions,
    malls,
    places,
    dishes,
    orders,
    wishes
  };
  cache.setAll(next);
  localStore.saveAll(next);
  return {
    modules: selected,
    modulesLabel: modulesLabel(selected),
    snapshot: clone(next)
  };
}

module.exports = {
  exportPackage,
  importPackage,
  normalizeModules,
  modulesLabel,
  MODULE_LABELS,
  ATOMIC
};
