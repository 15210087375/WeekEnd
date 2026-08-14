const cache = require('./cache');
const { now, clone, sortBySortThenName } = require('./helpers');
const { uuid } = require('../utils/id');
const syncHook = require('./syncHook');

function list() {
  return cache.ensure().regions.slice().sort(sortBySortThenName);
}

function get(id) {
  return cache.ensure().regions.find((r) => r.id === id) || null;
}

function save(input) {
  const c = cache.ensure();
  const name = String(input.name || '').trim();
  if (!name) throw new Error('区域名称不能为空');

  const t = now();
  if (input.id) {
    const idx = c.regions.findIndex((r) => r.id === input.id);
    if (idx < 0) throw new Error('区域不存在');
    c.regions[idx] = {
      ...c.regions[idx],
      name,
      sort: input.sort != null ? Number(input.sort) : c.regions[idx].sort,
      updatedAt: t
    };
    cache.persistRegions();
    const saved = clone(c.regions[idx]);
    syncHook.afterSave('region', saved);
    return saved;
  }

  const row = {
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    source: 'local',
    name,
    sort: input.sort != null ? Number(input.sort) : 0
  };
  c.regions.push(row);
  cache.persistRegions();
  const saved = clone(row);
  syncHook.afterSave('region', saved);
  return saved;
}

/**
 * 区域下的子项明细（删除前展示用）
 * @returns {{ malls: object[], places: object[], mallCount: number, placeCount: number, canDelete: boolean }}
 */
function getChildren(regionId) {
  const c = cache.ensure();
  const malls = c.malls
    .filter((m) => m.regionId === regionId)
    .map((m) => clone(m));
  const places = c.places
    .filter((p) => p.regionId === regionId)
    .map((p) => clone(p));
  return {
    malls,
    places,
    mallCount: malls.length,
    placeCount: places.length,
    canDelete: malls.length === 0 && places.length === 0
  };
}

function remove(id) {
  const kids = getChildren(id);
  if (!kids.canDelete) {
    const parts = [];
    if (kids.mallCount) parts.push(`${kids.mallCount} 个商场`);
    if (kids.placeCount) parts.push(`${kids.placeCount} 个门店`);
    throw new Error(`该区域下仍有${parts.join('、')}，请先处理后再删除`);
  }
  const c = cache.ensure();
  c.regions = c.regions.filter((r) => r.id !== id);
  cache.persistRegions();
  syncHook.afterRemove('region', id);
}

module.exports = { list, get, save, remove, getChildren };
