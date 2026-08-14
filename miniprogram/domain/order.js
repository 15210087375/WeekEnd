/**
 * 点餐订单
 * - 每单唯一 id
 * - mealDate 就餐日期
 * - status: preorder | cooking | dined | abandoned
 */
const cache = require('./cache');
const dish = require('./dish');
const { now, clone } = require('./helpers');
const { uuid } = require('../utils/id');
const { categoryLabel, normalizeCategory } = require('../config/categories');
const { ORDER_STATUS, ORDER_STATUS_LABELS } = require('../utils/constants');
const syncHook = require('./syncHook');

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function todayStr(ts) {
  const d = ts ? new Date(ts) : new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function normalizeStatus(raw) {
  const s = String(raw || '').trim();
  if (ORDER_STATUS_LABELS[s]) return s;
  // 兼容旧数据无 status → 视为已就餐（历史清单）
  return ORDER_STATUS.DINED;
}

function normalizeItems(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((it) => ({
      dishId: it.dishId || '',
      name: String(it.name || '').trim(),
      category: normalizeCategory(it.category),
      categoryLabel: it.categoryLabel || categoryLabel(it.category),
      placeLabel: String(it.placeLabel || ''),
      spicy: it.spicy != null ? it.spicy : null,
      score: it.score != null ? it.score : null,
      kind: it.kind || 'dine_out',
      addedBy: it.addedBy || '',
      addedByName: it.addedByName || ''
    }))
    .filter((it) => it.name);
}

function normalizeOrder(o) {
  if (!o) return null;
  return {
    ...o,
    status: o.status ? normalizeStatus(o.status) : ORDER_STATUS.DINED,
    mealDate: o.mealDate || todayStr(o.createdAt),
    items: normalizeItems(o.items),
    title: o.title || '点餐',
    note: o.note || ''
  };
}

function enrich(o) {
  const row = normalizeOrder(o);
  if (!row) return null;
  return {
    ...clone(row),
    statusLabel: ORDER_STATUS_LABELS[row.status] || row.status,
    itemCount: (row.items || []).length
  };
}

function list(filter) {
  let rows = cache.ensure().orders.map(normalizeOrder).filter(Boolean);
  if (filter) {
    if (filter.status) {
      const st = normalizeStatus(filter.status);
      rows = rows.filter((o) => o.status === st);
    }
    if (filter.statuses && Array.isArray(filter.statuses)) {
      const set = {};
      filter.statuses.forEach((s) => {
        set[normalizeStatus(s)] = true;
      });
      rows = rows.filter((o) => set[o.status]);
    }
    if (filter.mealDate) {
      rows = rows.filter((o) => o.mealDate === filter.mealDate);
    }
  }
  rows.sort((a, b) => {
    // 预点餐/制作中优先，再按日期、更新时间
    const rank = { preorder: 0, cooking: 1, dined: 2, abandoned: 3 };
    const ra = rank[a.status] != null ? rank[a.status] : 9;
    const rb = rank[b.status] != null ? rank[b.status] : 9;
    if (ra !== rb) return ra - rb;
    if (a.mealDate !== b.mealDate) {
      return String(b.mealDate).localeCompare(String(a.mealDate));
    }
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  return rows.map(enrich);
}

function listPreorders() {
  return list({ status: ORDER_STATUS.PREORDER });
}

function listOpen() {
  return list({
    statuses: [ORDER_STATUS.PREORDER, ORDER_STATUS.COOKING]
  });
}

function get(id) {
  const row = cache.ensure().orders.find((o) => o.id === id) || null;
  return enrich(row);
}

function itemFromDish(d) {
  const enriched = dish.enrich(d);
  return {
    dishId: d.id,
    name: d.name,
    category: normalizeCategory(d.category),
    categoryLabel: categoryLabel(d.category),
    placeLabel: (enriched && enriched.placeLabel) || '',
    spicy: d.spicy,
    score: d.score,
    kind: d.kind
  };
}

/**
 * 创建订单（预点餐允许空菜）
 * @param {{
 *   title?: string,
 *   note?: string,
 *   mealDate?: string,
 *   status?: string,
 *   dishIds?: string[],
 *   items?: object[],
 *   allowEmpty?: boolean,
 *   id?: string
 * }} input
 */
function create(input) {
  const c = cache.ensure();
  let items = [];
  if (Array.isArray(input.items) && input.items.length) {
    items = normalizeItems(input.items);
  } else if (Array.isArray(input.dishIds)) {
    items = input.dishIds
      .map((id) => dish.get(id))
      .filter(Boolean)
      .map(itemFromDish);
  }
  const status = input.status
    ? normalizeStatus(input.status)
    : ORDER_STATUS.PREORDER;
  const allowEmpty =
    !!input.allowEmpty ||
    status === ORDER_STATUS.PREORDER ||
    status === ORDER_STATUS.COOKING;
  if (!items.length && !allowEmpty) {
    throw new Error('请至少选择一道菜');
  }

  const t = now();
  const mealDate = String(input.mealDate || todayStr()).slice(0, 10);
  const row = {
    id: input.id || uuid(),
    createdAt: t,
    updatedAt: t,
    source: 'local',
    title:
      String(input.title || '').trim() ||
      (status === ORDER_STATUS.PREORDER ? '预点餐' : '点餐'),
    note: String(input.note || '').trim(),
    mealDate,
    status,
    items
  };
  // 避免 id 冲突
  if (c.orders.some((o) => o.id === row.id)) {
    row.id = uuid();
  }
  c.orders.unshift(row);
  cache.persistOrders();
  const saved = clone(row);
  syncHook.afterSave('order', saved);
  return enrich(saved);
}

/**
 * 更新订单字段/菜品
 */
function save(input) {
  if (!input || !input.id) throw new Error('缺少订单 id');
  const c = cache.ensure();
  const idx = c.orders.findIndex((o) => o.id === input.id);
  if (idx < 0) throw new Error('订单不存在');
  const prev = normalizeOrder(c.orders[idx]);
  const t = now();
  let items = prev.items;
  if (Array.isArray(input.items)) {
    items = normalizeItems(input.items);
  }
  const next = {
    ...prev,
    title:
      input.title != null
        ? String(input.title).trim() || prev.title
        : prev.title,
    note: input.note != null ? String(input.note).trim() : prev.note,
    mealDate: input.mealDate
      ? String(input.mealDate).slice(0, 10)
      : prev.mealDate,
    status: input.status ? normalizeStatus(input.status) : prev.status,
    items,
    updatedAt: t
  };
  c.orders[idx] = next;
  cache.persistOrders();
  const saved = clone(next);
  syncHook.afterSave('order', saved);
  return enrich(saved);
}

function setStatus(id, status) {
  return save({ id, status: normalizeStatus(status) });
}

function setMealDate(id, mealDate) {
  if (!mealDate) throw new Error('请选择日期');
  return save({ id, mealDate: String(mealDate).slice(0, 10) });
}

function setItems(id, items) {
  return save({ id, items: normalizeItems(items) });
}

function remove(id) {
  const c = cache.ensure();
  c.orders = c.orders.filter((o) => o.id !== id);
  cache.persistOrders();
  syncHook.afterRemove('order', id);
}

/** 紧凑分享载荷（控制 path 长度） */
function toSharePayload(order) {
  const o = normalizeOrder(order) || order;
  return {
    t: o.title || '想吃清单',
    n: o.note || '',
    d: o.mealDate || '',
    s: o.status || '',
    i: (o.items || []).map((it) => ({
      n: it.name,
      c: it.categoryLabel || categoryLabel(it.category),
      p: it.placeLabel || ''
    }))
  };
}

function encodeShareQuery(order) {
  const json = JSON.stringify(toSharePayload(order));
  const encoded = encodeURIComponent(json);
  return {
    encoded,
    tooLong: encoded.length > 1800,
    payload: toSharePayload(order)
  };
}

function parseShareQuery(raw) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(raw));
    if (!obj || !Array.isArray(obj.i)) return null;
    return {
      title: obj.t || '想吃清单',
      note: obj.n || '',
      mealDate: obj.d || '',
      status: obj.s || '',
      items: obj.i
        .map((it) => ({
          name: it.n || '',
          categoryLabel: it.c || '',
          placeLabel: it.p || ''
        }))
        .filter((it) => it.name)
    };
  } catch (e) {
    return null;
  }
}

function toShareText(order) {
  const o = normalizeOrder(order) || order;
  const lines = [];
  const st = ORDER_STATUS_LABELS[o.status] || '';
  lines.push(`【${o.title || '想吃清单'}】${st ? ` ${st}` : ''}`);
  if (o.mealDate) lines.push(`日期：${o.mealDate}`);
  if (o.note) lines.push(o.note);
  lines.push('');
  (o.items || []).forEach((it, idx) => {
    const cat = it.categoryLabel || categoryLabel(it.category);
    const place = it.placeLabel ? ` · ${it.placeLabel}` : '';
    lines.push(`${idx + 1}. ${it.name}（${cat}）${place}`);
  });
  lines.push('');
  lines.push('— 来自周末美食小程序');
  return lines.join('\n');
}

module.exports = {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  todayStr,
  normalizeStatus,
  normalizeOrder,
  list,
  listPreorders,
  listOpen,
  get,
  create,
  save,
  setStatus,
  setMealDate,
  setItems,
  remove,
  itemFromDish,
  toSharePayload,
  encodeShareQuery,
  parseShareQuery,
  toShareText
};
