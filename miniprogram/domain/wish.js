/**
 * 心愿单：任意「想要/想做」条目（与美食域解耦）
 */
const cache = require('./cache');
const imageStore = require('../services/imageStore');
const { now, clone } = require('./helpers');
const { uuid } = require('../utils/id');
const {
  WISH_STATUS,
  WISH_STATUS_LABELS,
  WISH_STATUS_ORDER
} = require('../utils/constants');
const syncHook = require('./syncHook');

const VALID_STATUS = {
  [WISH_STATUS.WANT]: true,
  [WISH_STATUS.DOING]: true,
  [WISH_STATUS.DONE]: true,
  [WISH_STATUS.DROP]: true
};

function normalizeStatus(raw) {
  const s = String(raw || '').trim();
  return VALID_STATUS[s] ? s : WISH_STATUS.WANT;
}

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img) => img && img.localPath)
    .map((img) => ({
      localPath: String(img.localPath),
      remoteUrl: img.remoteUrl || undefined,
      fileId: img.fileId || undefined
    }));
}

function parsePrice(raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function enrich(row) {
  if (!row) return null;
  return {
    ...clone(row),
    statusLabel: WISH_STATUS_LABELS[row.status] || row.status,
    priceText:
      row.priceRef != null && row.priceRef !== ''
        ? `¥${Number(row.priceRef)}`
        : ''
  };
}

/**
 * @param {{ status?: string }} [filter]
 */
function list(filter) {
  const statusFilter = filter && filter.status ? normalizeStatus(filter.status) : '';
  let rows = cache.ensure().wishes.slice();
  // 私密心愿仅本人可见（本地兜底）
  try {
    const space = require('./space');
    const sess = space.getSession() || {};
    const uid = sess.userId || '';
    rows = rows.filter((w) => {
      if (w.visibility !== 'private') return true;
      if (!w.createdBy) return true;
      return !uid || w.createdBy === uid;
    });
  } catch (e) {
    // ignore
  }
  if (filter && filter.status) {
    rows = rows.filter((w) => w.status === statusFilter);
  }
  rows.sort((a, b) => {
    const oa = WISH_STATUS_ORDER[a.status] != null ? WISH_STATUS_ORDER[a.status] : 9;
    const ob = WISH_STATUS_ORDER[b.status] != null ? WISH_STATUS_ORDER[b.status] : 9;
    if (oa !== ob) return oa - ob;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  return rows.map(enrich);
}

function get(id) {
  const row = cache.ensure().wishes.find((w) => w.id === id) || null;
  return enrich(row);
}

/**
 * @param {{
 *   id?: string,
 *   title: string,
 *   category?: string,
 *   status?: string,
 *   note?: string,
 *   priceRef?: number|string|null,
 *   images?: object[]
 * }} input
 */
function save(input) {
  const title = String((input && input.title) || '').trim();
  if (!title) throw new Error('标题不能为空');

  const c = cache.ensure();
  const t = now();
  const category = String((input && input.category) || '').trim();
  const status = normalizeStatus(input && input.status);
  const note = String((input && input.note) || '').trim();
  const priceRef = parsePrice(input && input.priceRef);
  const images = normalizeImages(input && input.images);
  const visibility =
    input && input.visibility === 'private' ? 'private' : 'space';

  let createdBy = '';
  try {
    const space = require('./space');
    const sess = space.getSession();
    createdBy = (sess && sess.userId) || '';
  } catch (e) {
    createdBy = '';
  }

  if (input && input.id) {
    const idx = c.wishes.findIndex((w) => w.id === input.id);
    if (idx >= 0) {
      const prev = c.wishes[idx];
      // 移除被删掉的图片文件
      const nextPaths = new Set(images.map((i) => i.localPath));
      (prev.images || []).forEach((img) => {
        if (img && img.localPath && !nextPaths.has(img.localPath)) {
          imageStore.removeFileQuiet(img.localPath);
        }
      });
      c.wishes[idx] = {
        ...prev,
        title,
        category,
        status,
        note,
        priceRef,
        images,
        visibility,
        createdBy: prev.createdBy || createdBy,
        updatedAt: t
      };
      cache.persistWishes();
      const saved = enrich(c.wishes[idx]);
      syncHook.afterSave('wish', c.wishes[idx]);
      return saved;
    }
    // 预分配 id（新建时已落盘图片目录用同一 id）
    const row = {
      id: input.id,
      createdAt: t,
      updatedAt: t,
      source: 'local',
      title,
      category,
      status,
      note,
      priceRef,
      images,
      visibility,
      createdBy
    };
    c.wishes.unshift(row);
    cache.persistWishes();
    syncHook.afterSave('wish', row);
    return enrich(row);
  }

  const row = {
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    source: 'local',
    title,
    category,
    status,
    note,
    priceRef,
    images,
    visibility,
    createdBy
  };
  c.wishes.unshift(row);
  cache.persistWishes();
  syncHook.afterSave('wish', row);
  return enrich(row);
}

function remove(id) {
  const c = cache.ensure();
  const row = c.wishes.find((w) => w.id === id);
  if (row) imageStore.removeDishImages(row.images);
  c.wishes = c.wishes.filter((w) => w.id !== id);
  cache.persistWishes();
  syncHook.afterRemove('wish', id);
}

module.exports = {
  list,
  get,
  save,
  remove,
  enrich,
  normalizeStatus
};
