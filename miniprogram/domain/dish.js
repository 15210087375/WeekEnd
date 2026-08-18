const cache = require('./cache');
const place = require('./place');
const region = require('./region');
const mall = require('./mall');
const imageStore = require('../services/imageStore');
const { now, clone } = require('./helpers');
const { uuid } = require('../utils/id');
const { DISH_KIND } = require('../utils/constants');
const { isHalfStepScore, normalizeTags, normalizeLines } = require('../utils/validate');
const { normalizeCategory } = require('../config/categories');
const syncHook = require('./syncHook');

/** 菜谱同名键：去首尾空白、合并空格、小写 */
function nameKey(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * 同名只保留一条（调用方保证已按 updatedAt 降序时，保留最新）
 * @param {object[]} rows
 */
function dedupeHomemadeByName(rows) {
  const seen = Object.create(null);
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const d = rows[i];
    if (!d || d.kind !== DISH_KIND.HOMEMADE) {
      out.push(d);
      continue;
    }
    const k = nameKey(d.name);
    if (!k || seen[k]) continue;
    seen[k] = true;
    out.push(d);
  }
  return out;
}

/**
 * 落盘剔除「我的菜谱」同名冗余：同名保留 updatedAt 最新一条，其余删除。
 * 订单/点餐项里的 dishId 会重映射到保留 id，避免材料清单断链。
 * @returns {number} 删除条数
 */
function purgeHomemadeNameDupes() {
  const c = cache.ensure();
  const homemade = c.dishes
    .filter((d) => d && d.kind === DISH_KIND.HOMEMADE)
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const keepIds = Object.create(null);
  /** @type {Record<string, string>} 被删 id → 保留 id */
  const removeToKeep = Object.create(null);
  const removeIds = [];
  homemade.forEach((d) => {
    const k = nameKey(d.name);
    if (!k) return;
    if (keepIds[k]) {
      removeIds.push(d.id);
      removeToKeep[d.id] = keepIds[k];
    } else {
      keepIds[k] = d.id;
    }
  });
  if (!removeIds.length) return 0;
  const removeSet = new Set(removeIds);
  const doomed = c.dishes.filter((d) => removeSet.has(d.id));
  doomed.forEach((d) => {
    try {
      imageStore.removeDishImages(d.images);
    } catch (e) {
      // ignore
    }
  });
  c.dishes = c.dishes.filter((d) => !removeSet.has(d.id));
  cache.persistDishes();

  // 订单项 dishId 重映射，否则厨师台材料清单 dish.get 为空
  let ordersTouched = false;
  (c.orders || []).forEach((o) => {
    if (!o || !Array.isArray(o.items)) return;
    o.items.forEach((it) => {
      if (!it || !it.dishId) return;
      const next = removeToKeep[it.dishId];
      if (next) {
        it.dishId = next;
        ordersTouched = true;
      }
    });
  });
  if (ordersTouched) {
    try {
      cache.persistOrders();
    } catch (e) {
      // ignore
    }
  }

  removeIds.forEach((id) => {
    try {
      syncHook.afterRemove('dish', id);
    } catch (e) {
      // ignore
    }
  });
  return removeIds.length;
}

/**
 * 按名称找菜谱（用于订单 dishId 失效时回退）
 * @param {string} name
 * @returns {object|null}
 */
function findHomemadeByName(name) {
  const key = nameKey(name);
  if (!key) return null;
  const rows = cache
    .ensure()
    .dishes.filter((d) => d && d.kind === DISH_KIND.HOMEMADE)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  for (let i = 0; i < rows.length; i++) {
    if (nameKey(rows[i].name) === key) return rows[i];
  }
  return null;
}

function list(filter) {
  const c = cache.ensure();
  let rows = c.dishes.slice();
  if (filter) {
    if (filter.placeId) rows = rows.filter((d) => d.placeId === filter.placeId);
    if (filter.kind) rows = rows.filter((d) => d.kind === filter.kind);
    if (filter.category) {
      rows = rows.filter(
        (d) => normalizeCategory(d.category) === normalizeCategory(filter.category)
      );
    }
    if (filter.regionId) {
      const placeIds = new Set(
        c.places.filter((p) => p.regionId === filter.regionId).map((p) => p.id)
      );
      rows = rows.filter((d) => placeIds.has(d.placeId));
    }
    if (filter.spicy != null && filter.spicy !== '') {
      rows = rows.filter((d) => d.spicy === Number(filter.spicy));
    }
    if (filter.minScore != null && filter.minScore !== '') {
      const min = Number(filter.minScore);
      rows = rows.filter((d) => d.score != null && d.score >= min);
    }
    if (filter.keyword) {
      const k = String(filter.keyword).trim().toLowerCase();
      rows = rows.filter((d) => {
        if (d.name && d.name.toLowerCase().includes(k)) return true;
        if (d.note && d.note.toLowerCase().includes(k)) return true;
        if ((d.tasteTags || []).some((t) => String(t).toLowerCase().includes(k))) {
          return true;
        }
        const p = place.get(d.placeId);
        if (p && p.brandName && p.brandName.toLowerCase().includes(k)) return true;
        return false;
      });
    }
  }
  rows = rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  // 菜谱：同名只展示一条（防同步/历史脏数据）
  if (!filter || !filter.kind || filter.kind === DISH_KIND.HOMEMADE) {
    if (filter && filter.kind === DISH_KIND.HOMEMADE) {
      rows = dedupeHomemadeByName(rows);
    } else if (!filter || !filter.kind) {
      // 混合列表：仅对 homemade 去重，外出菜保留
      const out = [];
      const seenHome = Object.create(null);
      rows.forEach((d) => {
        if (d.kind !== DISH_KIND.HOMEMADE) {
          out.push(d);
          return;
        }
        const k = nameKey(d.name);
        if (k && seenHome[k]) return;
        if (k) seenHome[k] = true;
        out.push(d);
      });
      rows = out;
    }
  }
  return rows;
}

function get(id) {
  return cache.ensure().dishes.find((d) => d.id === id) || null;
}

function normalizePayload(input) {
  const name = String(input.name || '').trim();
  const kind = input.kind;
  const placeId = input.placeId;

  if (!name) throw new Error('菜品名称不能为空');
  if (kind !== DISH_KIND.DINE_OUT && kind !== DISH_KIND.HOMEMADE) {
    throw new Error('菜品类型无效');
  }
  if (!placeId || !place.get(placeId)) throw new Error('所属门店无效');

  let score = input.score;
  if (score === '' || score === undefined) score = null;
  if (score != null) score = Number(score);
  if (!isHalfStepScore(score)) throw new Error('评分须为 0–10 整数（半星 1 分）');

  let spicy = input.spicy;
  if (spicy === '' || spicy === undefined || spicy === null) spicy = null;
  else {
    spicy = Number(spicy);
    if (![0, 1, 2, 3].includes(spicy)) throw new Error('辣度无效');
  }

  return {
    placeId,
    kind,
    name,
    category: normalizeCategory(input.category),
    score,
    tasteTags: normalizeTags(input.tasteTags),
    spicy,
    note: String(input.note || '').trim(),
    images: Array.isArray(input.images) ? input.images : [],
    steps: normalizeLines(input.steps),
    ingredients: normalizeLines(input.ingredients),
    videoUrl: String(input.videoUrl || '').trim()
  };
}

/**
 * 按分区裁剪字段：避免跨业务脏数据
 */
function applyModuleFields(kind, payload) {
  if (kind === DISH_KIND.HOMEMADE) {
    return {
      ...payload,
      spicy: null,
      tasteTags: [],
      // 菜谱保留用料/步骤/视频/自评
      ingredients: payload.ingredients || [],
      steps: payload.steps || [],
      videoUrl: payload.videoUrl || ''
    };
  }
  return {
    ...payload,
    ingredients: [],
    steps: [],
    videoUrl: ''
  };
}

/**
 * 我的菜谱是否已有同名（排除自身 id）
 * @param {string} name
 * @param {string} [excludeId]
 * @returns {boolean}
 */
function isHomemadeNameTaken(name, excludeId) {
  const key = nameKey(name);
  if (!key) return false;
  return cache.ensure().dishes.some(
    (d) =>
      d.kind === DISH_KIND.HOMEMADE &&
      nameKey(d.name) === key &&
      (!excludeId || d.id !== excludeId)
  );
}

/**
 * 我的菜谱：同名不可并存（排除自身 id）
 * 手动录入抛错；批量（skipIfDuplicate）由 save 吞掉
 */
function assertHomemadeNameUnique(name, excludeId) {
  if (isHomemadeNameTaken(name, excludeId)) {
    throw new Error('保存不成功：已有同名菜谱，请改名');
  }
}

/**
 * @param {object} input
 * @param {boolean} [input.skipIfDuplicate] 批量导入：同名直接跳过返回 null，不抛错、不提示
 */
function save(input) {
  const c = cache.ensure();
  let payload = normalizePayload(input);
  payload = applyModuleFields(payload.kind, payload);
  const t = now();

  if (payload.kind === DISH_KIND.HOMEMADE) {
    if (isHomemadeNameTaken(payload.name, input.id || null)) {
      // 批量：静默跳过；单条：明确失败让用户改名
      if (input.skipIfDuplicate || input.batch) {
        return null;
      }
      throw new Error('保存不成功：已有同名菜谱，请改名');
    }
  }

  if (input.id) {
    const idx = c.dishes.findIndex((d) => d.id === input.id);
    if (idx >= 0) {
      c.dishes[idx] = {
        ...c.dishes[idx],
        ...payload,
        updatedAt: t
      };
      cache.persistDishes();
      const saved = clone(c.dishes[idx]);
      syncHook.afterSave('dish', saved);
      return saved;
    }
    const row = {
      id: input.id,
      createdAt: t,
      updatedAt: t,
      source: 'local',
      ...payload
    };
    c.dishes.push(row);
    cache.persistDishes();
    const savedNew = clone(row);
    syncHook.afterSave('dish', savedNew);
    return savedNew;
  }

  const row = {
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    source: 'local',
    ...payload
  };
  c.dishes.push(row);
  cache.persistDishes();
  const saved = clone(row);
  syncHook.afterSave('dish', saved);
  return saved;
}

function remove(id) {
  const c = cache.ensure();
  const dish = get(id);
  if (!dish) return;
  imageStore.removeDishImages(dish.images);
  c.dishes = c.dishes.filter((d) => d.id !== id);
  cache.persistDishes();
  syncHook.afterRemove('dish', id);
}

function enrich(dish) {
  if (!dish) return null;
  const p = place.get(dish.placeId);
  const r = p ? region.get(p.regionId) : null;
  const m = p && p.mallId ? mall.get(p.mallId) : null;
  return {
    ...clone(dish),
    place: p,
    region: r,
    mall: m,
    placeLabel: place.label(p)
  };
}

function search(query) {
  return list(query || {});
}

module.exports = {
  list,
  get,
  save,
  remove,
  enrich,
  search,
  applyModuleFields,
  nameKey,
  isHomemadeNameTaken,
  purgeHomemadeNameDupes,
  findHomemadeByName
};
