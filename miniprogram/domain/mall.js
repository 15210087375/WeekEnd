const cache = require('./cache');
const region = require('./region');
const { now, clone, sortBySortThenName } = require('./helpers');
const { uuid } = require('../utils/id');
const syncHook = require('./syncHook');

function list(regionId) {
  let list = cache.ensure().malls.slice();
  if (regionId) list = list.filter((m) => m.regionId === regionId);
  return list.sort(sortBySortThenName);
}

function get(id) {
  return cache.ensure().malls.find((m) => m.id === id) || null;
}

function save(input) {
  const c = cache.ensure();
  const name = String(input.name || '').trim();
  const regionId = input.regionId;
  if (!name) throw new Error('商场名称不能为空');
  if (!regionId || !region.get(regionId)) throw new Error('所属区域无效');

  const t = now();
  if (input.id) {
    const idx = c.malls.findIndex((m) => m.id === input.id);
    if (idx < 0) throw new Error('商场不存在');
    c.malls[idx] = {
      ...c.malls[idx],
      name,
      regionId,
      sort: input.sort != null ? Number(input.sort) : c.malls[idx].sort,
      updatedAt: t
    };
    cache.persistMalls();
    const saved = clone(c.malls[idx]);
    syncHook.afterSave('mall', saved);
    return saved;
  }

  const row = {
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    source: 'local',
    regionId,
    name,
    sort: input.sort != null ? Number(input.sort) : 0
  };
  c.malls.push(row);
  cache.persistMalls();
  const saved = clone(row);
  syncHook.afterSave('mall', saved);
  return saved;
}

function remove(id) {
  const c = cache.ensure();
  if (c.places.some((p) => p.mallId === id)) {
    throw new Error('该商场下仍有门店，请先处理子项后再删除');
  }
  c.malls = c.malls.filter((m) => m.id !== id);
  cache.persistMalls();
  syncHook.afterRemove('mall', id);
}

module.exports = { list, get, save, remove };
