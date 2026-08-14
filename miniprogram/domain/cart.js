/**
 * 当前点餐 = 绑定「预点餐 / 制作中」订单
 * - 每单唯一 id，可选 mealDate
 * - 多份预点餐可切换
 * - 勾选仅本地；下单整表同步；删除 3s 防抖同步
 */
const localStore = require('../services/localStore');
const dish = require('./dish');
const order = require('./order');
const space = require('./space');
const cloud = require('../services/cloud');
const { STORAGE_KEYS, ORDER_STATUS } = require('../utils/constants');
const { clone } = require('./helpers');

const REMOVE_PUSH_DEBOUNCE_MS = 3000;
let removePushTimer = null;

function isSharedMode() {
  try {
    cloud.init();
    return space.isInSpace() && cloud.isReady();
  } catch (e) {
    return false;
  }
}

function getSessionUser() {
  try {
    return space.getSession() || {};
  } catch (e) {
    return {};
  }
}

function getActiveOrderId() {
  const id = localStore.readJson(STORAGE_KEYS.activeOrderId, '');
  return id ? String(id) : '';
}

function setActiveOrderId(id) {
  localStore.writeJson(STORAGE_KEYS.activeOrderId, id ? String(id) : '');
}

/**
 * 旧版 wfa:currentCart 迁移为一条预点餐
 */
function migrateLegacyCart() {
  const raw = localStore.readJson(STORAGE_KEYS.currentCart, null);
  if (!raw) return;
  let items = [];
  if (Array.isArray(raw.items) && raw.items.length) {
    items = raw.items;
  } else if (Array.isArray(raw.dishIds) && raw.dishIds.length) {
    raw.dishIds.forEach((id) => {
      const d = dish.get(id);
      if (d) items.push(order.itemFromDish(d));
    });
  }
  if (items.length) {
    const row = order.create({
      title: '预点餐',
      status: ORDER_STATUS.PREORDER,
      mealDate: order.todayStr(),
      items,
      allowEmpty: false
    });
    setActiveOrderId(row.id);
  }
  try {
    wx.removeStorageSync(STORAGE_KEYS.currentCart);
  } catch (e) {
    localStore.writeJson(STORAGE_KEYS.currentCart, null);
  }
}

function ensureMigrated() {
  migrateLegacyCart();
}

/**
 * 当前可编辑订单：预点餐优先，否则制作中
 */
function getActiveOrder() {
  ensureMigrated();
  let id = getActiveOrderId();
  let o = id ? order.get(id) : null;
  if (o && (o.status === ORDER_STATUS.PREORDER || o.status === ORDER_STATUS.COOKING)) {
    return o;
  }
  const open = order.listOpen();
  if (open.length) {
    setActiveOrderId(open[0].id);
    return open[0];
  }
  return null;
}

/**
 * 确保有一份预点餐并设为当前
 * @param {string} [mealDate]
 * @param {string} [mealSlot]
 */
function ensureActivePreorder(mealDate, mealSlot) {
  ensureMigrated();
  let o = getActiveOrder();
  if (o && o.status === ORDER_STATUS.PREORDER) {
    const patch = { id: o.id };
    let need = false;
    if (mealDate && mealDate !== o.mealDate) {
      patch.mealDate = mealDate;
      need = true;
    }
    if (mealSlot && mealSlot !== o.mealSlot) {
      patch.mealSlot = mealSlot;
      need = true;
    }
    if (need) o = order.save(patch);
    return o;
  }
  // 有制作中但没有预点餐时，新建预点餐
  o = order.create({
    title: '预点餐',
    status: ORDER_STATUS.PREORDER,
    mealDate: mealDate || order.todayStr(),
    mealSlot: mealSlot || 'lunch',
    items: [],
    allowEmpty: true
  });
  setActiveOrderId(o.id);
  return o;
}

function listPreorders() {
  ensureMigrated();
  return order.listPreorders();
}

function listOpenOrders() {
  ensureMigrated();
  return order.listOpen();
}

function switchOrder(orderId) {
  const o = order.get(orderId);
  if (!o) throw new Error('订单不存在');
  if (o.status !== ORDER_STATUS.PREORDER && o.status !== ORDER_STATUS.COOKING) {
    throw new Error('只能切换到预点餐或制作中的订单');
  }
  setActiveOrderId(o.id);
  return o;
}

/**
 * @param {string} [mealDate]
 * @param {string} [mealSlot]
 */
function createPreorder(mealDate, mealSlot) {
  const o = order.create({
    title: '预点餐',
    status: ORDER_STATUS.PREORDER,
    mealDate: mealDate || order.todayStr(),
    mealSlot: mealSlot || 'lunch',
    items: [],
    allowEmpty: true
  });
  setActiveOrderId(o.id);
  return o;
}

function itemFromDishId(dishId) {
  if (!dishId) return null;
  const d = dish.get(String(dishId));
  if (!d) return null;
  const it = order.itemFromDish(d);
  const sess = getSessionUser();
  if (sess.userId) {
    it.addedBy = sess.userId;
    it.addedByName = sess.displayName || '家人';
  }
  return it;
}

function getDishIds() {
  const o = getActiveOrder();
  if (!o) return [];
  return (o.items || []).map((it) => it.dishId).filter(Boolean);
}

function count() {
  const o = getActiveOrder();
  return o && o.items ? o.items.length : 0;
}

function has(dishId) {
  if (!dishId) return false;
  const id = String(dishId);
  return getDishIds().indexOf(id) >= 0;
}

function listItems() {
  const o = getActiveOrder();
  return clone((o && o.items) || []);
}

function snapshot() {
  ensureMigrated();
  const active = getActiveOrder();
  const preorders = listPreorders();
  const open = listOpenOrders();
  const items = (active && active.items) || [];
  return {
    orderId: active ? active.id : '',
    mealDate: active ? active.mealDate : order.todayStr(),
    mealSlot: active ? active.mealSlot : 'lunch',
    mealSlotLabel: active ? active.mealSlotLabel : order.mealSlotLabel('lunch'),
    scheduleText: active
      ? active.scheduleText
      : order.scheduleText(order.todayStr(), 'lunch'),
    status: active ? active.status : '',
    statusLabel: active ? active.statusLabel : '',
    title: active ? active.title : '',
    dishIds: items.map((it) => it.dishId).filter(Boolean),
    count: items.length,
    items: clone(items),
    preorders,
    openOrders: open,
    shared: isSharedMode()
  };
}

function cancelDebouncedRemovePush() {
  if (removePushTimer) {
    clearTimeout(removePushTimer);
    removePushTimer = null;
  }
}

function scheduleDebouncedPush() {
  if (!isSharedMode()) return;
  if (removePushTimer) clearTimeout(removePushTimer);
  removePushTimer = setTimeout(() => {
    removePushTimer = null;
    const o = getActiveOrder();
    if (o) {
      // 再存一次触发 sync（save 已 hook）；并 push 订单
      try {
        order.save({ id: o.id, items: o.items });
      } catch (e) {
        console.warn('[cart] debounced save', e);
      }
    }
  }, REMOVE_PUSH_DEBOUNCE_MS);
}

function add(dishId) {
  const it = itemFromDishId(dishId);
  if (!it) return Promise.reject(new Error('菜品不存在或无法加入'));
  const active = ensureActivePreorder();
  if (active.status === ORDER_STATUS.COOKING) {
    // 制作中仍允许加菜
  } else if (active.status !== ORDER_STATUS.PREORDER) {
    return Promise.reject(new Error('当前订单不可加菜'));
  }
  const items = (active.items || []).slice();
  if (items.some((x) => String(x.dishId) === String(it.dishId))) {
    return Promise.resolve(snapshot());
  }
  items.push(it);
  order.setItems(active.id, items);
  setActiveOrderId(active.id);
  return Promise.resolve(snapshot());
}

function remove(dishId) {
  const active = getActiveOrder();
  if (!active) return Promise.resolve(snapshot());
  const id = String(dishId || '');
  const items = (active.items || []).filter((it) => String(it.dishId) !== id);
  order.setItems(active.id, items);
  scheduleDebouncedPush();
  return Promise.resolve(snapshot());
}

function toggle(dishId) {
  if (!dishId) return Promise.reject(new Error('无效菜品'));
  if (has(dishId)) return remove(dishId);
  return add(dishId);
}

/**
 * 下单：确认当前预点餐；家庭模式触发同步（订单已通过 save hook 上传）
 */
function placeOrder() {
  const active = ensureActivePreorder();
  if (!(active.items && active.items.length)) {
    return Promise.reject(new Error('请先勾选菜品'));
  }
  cancelDebouncedRemovePush();
  // 保持预点餐状态，仅同步
  const saved = order.save({
    id: active.id,
    items: active.items,
    status: ORDER_STATUS.PREORDER
  });
  setActiveOrderId(saved.id);
  if (!isSharedMode()) {
    return Promise.resolve(snapshot());
  }
  // 强制再推一次队列
  try {
    const sync = require('./sync');
    return sync.flushQueue().then(() => snapshot());
  } catch (e) {
    return Promise.resolve(snapshot());
  }
}

function setActiveMealDate(mealDate) {
  const active = ensureActivePreorder(mealDate);
  return order.setMealDate(active.id, mealDate);
}

/**
 * 设置当前订单的日期+餐次
 */
function setActiveSchedule(mealDate, mealSlot) {
  const active = ensureActivePreorder(mealDate, mealSlot);
  return order.setSchedule(active.id, mealDate, mealSlot);
}

function markCooking() {
  const active = getActiveOrder();
  if (!active) throw new Error('当前没有点餐');
  if (!(active.items && active.items.length)) {
    throw new Error('请先点菜');
  }
  cancelDebouncedRemovePush();
  return order.setStatus(active.id, ORDER_STATUS.COOKING);
}

function settle(input) {
  const active = getActiveOrder();
  if (!active) throw new Error('当前没有点餐');
  if (!(active.items && active.items.length)) {
    throw new Error('当前没有点餐');
  }
  cancelDebouncedRemovePush();
  const row = order.save({
    id: active.id,
    status: ORDER_STATUS.DINED,
    title: (input && input.title) || '已就餐',
    items: active.items
  });
  // 切到下一份预点餐或清空 active
  const rest = listPreorders();
  if (rest.length) setActiveOrderId(rest[0].id);
  else setActiveOrderId('');
  return clone(row);
}

function abandon() {
  const active = getActiveOrder();
  if (!active) return Promise.reject(new Error('当前没有点餐'));
  cancelDebouncedRemovePush();
  order.setStatus(active.id, ORDER_STATUS.ABANDONED);
  // 或直接删除：order.remove(active.id)
  const rest = listPreorders();
  if (rest.length) setActiveOrderId(rest[0].id);
  else {
    const open = listOpenOrders();
    setActiveOrderId(open.length ? open[0].id : '');
  }
  return Promise.resolve(snapshot());
}

function createShareOrder(input) {
  const active = getActiveOrder();
  if (!active || !(active.items && active.items.length)) {
    throw new Error('当前没有点餐');
  }
  // 分享用独立快照订单（已就餐样式的清单副本），不改当前预点餐
  return order.create({
    title: (input && input.title) || active.title || '想吃清单',
    note: active.note || '',
    mealDate: active.mealDate,
    status: ORDER_STATUS.DINED,
    items: active.items,
    allowEmpty: false
  });
}

function checkout(input) {
  return settle(input);
}

function clear() {
  return abandon();
}

/** 兼容：pull 改为同步业务订单 */
function pull() {
  if (!isSharedMode()) {
    return Promise.resolve(snapshot());
  }
  try {
    const sync = require('./sync');
    return sync.pull({ types: ['order'] }).then(() => {
      ensureMigrated();
      // active 失效则重选
      getActiveOrder();
      return snapshot();
    });
  } catch (e) {
    return Promise.resolve(snapshot());
  }
}

function push() {
  const active = getActiveOrder();
  if (active) {
    order.save({ id: active.id, items: active.items });
  }
  try {
    const sync = require('./sync');
    return sync.flushQueue().then(() => snapshot());
  } catch (e) {
    return Promise.resolve(snapshot());
  }
}

module.exports = {
  getActiveOrderId,
  getActiveOrder,
  ensureActivePreorder,
  listPreorders,
  listOpenOrders,
  switchOrder,
  createPreorder,
  setActiveMealDate,
  setActiveSchedule,
  markCooking,
  getDishIds,
  count,
  has,
  add,
  remove,
  toggle,
  placeOrder,
  clear,
  listItems,
  snapshot,
  createShareOrder,
  settle,
  abandon,
  checkout,
  pull,
  push,
  isSharedMode
};
