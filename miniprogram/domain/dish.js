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
  return rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
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
  if (!isHalfStepScore(score)) throw new Error('评分须为 0–5，步进 0.5');

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

function save(input) {
  const c = cache.ensure();
  let payload = normalizePayload(input);
  payload = applyModuleFields(payload.kind, payload);
  const t = now();

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
  applyModuleFields
};
