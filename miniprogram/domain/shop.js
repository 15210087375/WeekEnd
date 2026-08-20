/**
 * 购物账本：一笔消费（店名 + 金额 + 日期）
 */
const cache = require('./cache');
const { now, clone } = require('./helpers');
const { uuid } = require('../utils/id');
const { normalizeImages, pruneRemoved } = require('../utils/pickImages');
const { SHOP_CATEGORIES, SHOP_STATUS, SHOP_STATUS_LABELS } = require('../utils/constants');
const { parseScore10 } = require('../utils/score');
const syncHook = require('./syncHook');

const CAT_BY_ID = {};
const CAT_BY_NAME = {};
SHOP_CATEGORIES.forEach((c) => {
  CAT_BY_ID[c.id] = c.name;
  CAT_BY_NAME[c.name] = c.id;
});

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKeyOf(ymd) {
  return String(ymd || '').slice(0, 7);
}

function thisMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function lastMonthKey() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function parseAmount(raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function formatAmount(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function normalizeCategory(raw) {
  const key = String(raw || '').trim();
  if (!key) return '';
  if (CAT_BY_ID[key]) return key;
  if (CAT_BY_NAME[key]) return CAT_BY_NAME[key];
  return key;
}

function categoryLabel(raw) {
  const id = normalizeCategory(raw);
  if (!id) return '';
  if (CAT_BY_ID[id]) return CAT_BY_ID[id];
  if (/^[a-z0-9_]+$/i.test(id)) return '';
  return id;
}

function normalizeStatus(raw) {
  return String(raw || '') === SHOP_STATUS.PLANNED
    ? SHOP_STATUS.PLANNED
    : SHOP_STATUS.DONE;
}

function enrich(row) {
  if (!row) return null;
  const storeName = String(row.storeName || '').trim();
  const title = String(row.title || '').trim();
  const status = normalizeStatus(row.status);
  return {
    ...clone(row),
    storeName,
    title,
    status,
    statusLabel: SHOP_STATUS_LABELS[status] || status,
    displayTitle: storeName || '未填店名',
    itemText: title,
    amountText:
      status === SHOP_STATUS.PLANNED
        ? '计划'
        : row.amount != null
          ? `¥${formatAmount(row.amount)}`
          : '',
    category: normalizeCategory(row.category),
    categoryLabel: categoryLabel(row.category),
    worthScore: parseScore10(row.worthScore, false)
  };
}

function filterPrivate(rows) {
  try {
    const space = require('./space');
    const sess = space.getSession() || {};
    const uid = sess.userId || '';
    return rows.filter((w) => {
      if (w.visibility !== 'private') return true;
      if (!w.createdBy) return true;
      return !uid || w.createdBy === uid;
    });
  } catch (e) {
    return rows;
  }
}

/**
 * @param {{ category?: string, month?: 'this'|'last'|string }} [filter]
 */
function list(filter) {
  let rows = (cache.ensure().shopLogs || []).slice();
  rows = filterPrivate(rows);
  const cat = filter && filter.category ? normalizeCategory(filter.category) : '';
  if (cat) rows = rows.filter((r) => normalizeCategory(r.category) === cat);
  let month = filter && filter.month ? String(filter.month) : '';
  if (month === 'this') month = thisMonthKey();
  if (month === 'last') month = lastMonthKey();
  if (month) rows = rows.filter((r) => monthKeyOf(r.date) === month);
  if (filter && filter.status) {
    const st = normalizeStatus(filter.status);
    rows = rows.filter((r) => normalizeStatus(r.status) === st);
  }
  if (filter && filter.date) {
    const day = String(filter.date).slice(0, 10);
    rows = rows.filter((r) => String(r.date || '').slice(0, 10) === day);
  }
  rows.sort((a, b) => {
    const da = String(b.date || '');
    const db = String(a.date || '');
    if (da !== db) return da.localeCompare(db);
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  return rows.map(enrich);
}

function summarize(rows) {
  const list = rows || [];
  let sum = 0;
  list.forEach((r) => {
    if (r.amount != null) sum += Number(r.amount) || 0;
  });
  sum = Math.round(sum * 100) / 100;
  return {
    count: list.length,
    sum,
    summaryText: list.length
      ? `${list.length} 笔 · ¥${formatAmount(sum)}`
      : '还没有记账'
  };
}

function get(id) {
  const row = (cache.ensure().shopLogs || []).find((r) => r.id === id) || null;
  return enrich(row);
}

function save(input) {
  const storeName = String((input && input.storeName) || '').trim();
  const title = String((input && input.title) || '').trim();
  if (!storeName) throw new Error('请填写店名或去哪');
  const status = normalizeStatus(input && input.status);
  const amount = parseAmount(input && input.amount);
  if (status === SHOP_STATUS.DONE && amount == null) {
    throw new Error('请填写金额');
  }
  const date = String((input && input.date) || '').trim() || todayYmd();
  const category = normalizeCategory(input && input.category);
  const note = String((input && input.note) || '').trim();
  const worthScore = parseScore10(input && input.worthScore, false);
  const images = normalizeImages(input && input.images);
  const visibility =
    input && input.visibility === 'private' ? 'private' : 'space';

  const c = cache.ensure();
  if (!Array.isArray(c.shopLogs)) c.shopLogs = [];
  const t = now();

  let createdBy = '';
  let createdByMemberNo = 0;
  try {
    const space = require('./space');
    const who = space.actor();
    createdBy = who.userId || '';
    createdByMemberNo = who.memberNo || 0;
  } catch (e) {
    createdBy = '';
  }

  const payload = {
    storeName,
    title,
    status,
    amount,
    date,
    category,
    note,
    worthScore,
    images,
    visibility
  };

  if (input && input.id) {
    const idx = c.shopLogs.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      pruneRemoved(c.shopLogs[idx].images, images);
      c.shopLogs[idx] = {
        ...c.shopLogs[idx],
        ...payload,
        createdBy: c.shopLogs[idx].createdBy || createdBy,
        createdByMemberNo: c.shopLogs[idx].createdByMemberNo || createdByMemberNo,
        updatedAt: t
      };
      cache.persistShopLogs();
      syncHook.afterSave('shopLog', c.shopLogs[idx]);
      return enrich(c.shopLogs[idx]);
    }
    const row = {
      id: input.id,
      createdAt: t,
      updatedAt: t,
      source: 'local',
      createdBy,
      createdByMemberNo,
      ...payload
    };
    c.shopLogs.unshift(row);
    cache.persistShopLogs();
    syncHook.afterSave('shopLog', row);
    return enrich(row);
  }

  const row = {
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    source: 'local',
    createdBy,
    createdByMemberNo,
    ...payload
  };
  c.shopLogs.unshift(row);
  cache.persistShopLogs();
  syncHook.afterSave('shopLog', row);
  return enrich(row);
}

function remove(id) {
  const imageStore = require('../services/imageStore');
  const c = cache.ensure();
  const row = (c.shopLogs || []).find((r) => r.id === id);
  if (row) imageStore.removeDishImages(row.images);
  c.shopLogs = (c.shopLogs || []).filter((r) => r.id !== id);
  cache.persistShopLogs();
  syncHook.afterRemove('shopLog', id);
}

module.exports = {
  list,
  get,
  save,
  remove,
  enrich,
  summarize,
  todayYmd,
  thisMonthKey,
  lastMonthKey,
  categoryLabel
};
