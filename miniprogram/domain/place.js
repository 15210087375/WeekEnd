const cache = require('./cache');
const region = require('./region');
const mall = require('./mall');
const { now, clone } = require('./helpers');
const { uuid } = require('../utils/id');
const syncHook = require('./syncHook');

function list(filter) {
  let rows = cache.ensure().places.slice();
  if (filter) {
    if (filter.regionId) rows = rows.filter((p) => p.regionId === filter.regionId);
    if (filter.mallId === null) rows = rows.filter((p) => p.mallId == null);
    else if (filter.mallId) rows = rows.filter((p) => p.mallId === filter.mallId);
    if (filter.isVirtual != null) {
      rows = rows.filter((p) => !!p.isVirtual === !!filter.isVirtual);
    }
    if (filter.keyword) {
      const k = String(filter.keyword).trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          (p.brandName && p.brandName.toLowerCase().includes(k)) ||
          (p.storeName && p.storeName.toLowerCase().includes(k))
      );
    }
  }
  return rows.sort((a, b) =>
    String(a.brandName || '').localeCompare(String(b.brandName || ''), 'zh')
  );
}

function get(id) {
  return cache.ensure().places.find((p) => p.id === id) || null;
}

function label(p) {
  if (!p) return '';
  if (p.storeName) return `${p.brandName}（${p.storeName}）`;
  return p.brandName;
}

function save(input) {
  const c = cache.ensure();
  const brandName = String(input.brandName || '').trim();
  let regionId = input.regionId;
  let mallId = input.mallId === undefined ? null : input.mallId;

  if (!brandName) throw new Error('品牌名称不能为空');
  if (mallId) {
    const m = mall.get(mallId);
    if (!m) throw new Error('所属商场无效');
    regionId = m.regionId;
  }
  if (!regionId || !region.get(regionId)) throw new Error('所属区域无效');

  const t = now();
  const base = {
    regionId,
    mallId: mallId || null,
    brandName,
    storeName: String(input.storeName || '').trim(),
    address: String(input.address || '').trim(),
    navUrl: String(input.navUrl || '').trim(),
    note: String(input.note || '').trim(),
    isVirtual: !!input.isVirtual,
    updatedAt: t
  };

  if (input.id) {
    const idx = c.places.findIndex((p) => p.id === input.id);
    if (idx < 0) throw new Error('门店不存在');
    c.places[idx] = { ...c.places[idx], ...base };
    cache.persistPlaces();
    const saved = clone(c.places[idx]);
    syncHook.afterSave('place', saved);
    return saved;
  }

  const row = {
    id: uuid(),
    createdAt: t,
    source: 'local',
    ...base
  };
  c.places.push(row);
  cache.persistPlaces();
  const saved = clone(row);
  syncHook.afterSave('place', saved);
  return saved;
}

function remove(id) {
  const c = cache.ensure();
  if (c.dishes.some((d) => d.placeId === id)) {
    throw new Error('该门店下仍有菜品，请先处理子项后再删除');
  }
  c.places = c.places.filter((p) => p.id !== id);
  cache.persistPlaces();
  syncHook.afterRemove('place', id);
}

module.exports = { list, get, label, save, remove };
