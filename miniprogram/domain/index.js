/**
 * 领域门面：页面对外只依赖本文件（或 services/repository 兼容层）
 *
 * 分区：
 * - region / mall / place  → 地理与门店（美食档案主用）
 * - dish                   → 档案/菜谱记录
 * - seed                   → 默认挂载
 * - wish                   → 心愿单（娱乐）
 * - backup                 → 导入导出
 * - stats                  → 统计
 */
const cache = require('./cache');
const region = require('./region');
const mall = require('./mall');
const place = require('./place');
const dish = require('./dish');
const order = require('./order');
const cart = require('./cart');
const wish = require('./wish');
const space = require('./space');
const seed = require('./seed');
const seedSamples = require('./seedSamples');
const backup = require('./backup');
const stats = require('./stats');
const sync = require('./sync');
const cloud = require('../services/cloud');
const { clone } = require('./helpers');
const { DISH_KIND } = require('../utils/constants');

function init() {
  cache.ensure();
  try {
    cloud.init();
  } catch (e) {
    console.warn('[domain] cloud.init skip', e);
  }
  // 已入家庭则后台拉取一次
  try {
    if (space.isInSpace()) {
      sync.pull().catch(() => null);
      sync.flushQueue().catch(() => null);
    }
  } catch (e) {
    // ignore
  }
  return getSnapshot();
}

function reload() {
  cache.reload();
  return getSnapshot();
}

function getSnapshot() {
  return clone(cache.ensure());
}

module.exports = {
  init,
  reload,
  getSnapshot,

  listRegions: region.list,
  getRegion: region.get,
  saveRegion: region.save,
  deleteRegion: region.remove,
  getRegionChildren: region.getChildren,

  listMalls: mall.list,
  getMall: mall.get,
  saveMall: mall.save,
  deleteMall: mall.remove,

  listPlaces: place.list,
  getPlace: place.get,
  savePlace: place.save,
  deletePlace: place.remove,
  placeLabel: place.label,

  listDishes: dish.list,
  getDish: dish.get,
  saveDish: dish.save,
  deleteDish: dish.remove,
  searchDishes: dish.search,
  enrichDish: dish.enrich,

  listOrders: order.list,
  listPreorders: order.listPreorders,
  listOpenOrders: order.listOpen,
  getOrder: order.get,
  createOrder: order.create,
  saveOrder: order.save,
  deleteOrder: order.remove,
  setOrderStatus: order.setStatus,
  setOrderMealDate: order.setMealDate,
  encodeOrderShare: order.encodeShareQuery,
  parseOrderShare: order.parseShareQuery,
  orderShareText: order.toShareText,
  ORDER_STATUS: order.ORDER_STATUS,
  ORDER_STATUS_LABELS: order.ORDER_STATUS_LABELS,
  orderToday: order.todayStr,

  cartSnapshot: cart.snapshot,
  cartCount: cart.count,
  cartHas: cart.has,
  cartToggle: cart.toggle,
  cartAdd: cart.add,
  cartRemove: cart.remove,
  cartPlaceOrder: cart.placeOrder,
  cartClear: cart.clear,
  cartSettle: cart.settle,
  cartAbandon: cart.abandon,
  cartCreateShareOrder: cart.createShareOrder,
  cartCheckout: cart.checkout,
  cartGetDishIds: cart.getDishIds,
  cartPull: cart.pull,
  cartPush: cart.push,
  cartIsShared: cart.isSharedMode,
  cartEnsurePreorder: cart.ensureActivePreorder,
  cartCreatePreorder: cart.createPreorder,
  cartSwitchOrder: cart.switchOrder,
  cartSetMealDate: cart.setActiveMealDate,
  cartMarkCooking: cart.markCooking,
  cartListPreorders: cart.listPreorders,

  listWishes: wish.list,
  getWish: wish.get,
  saveWish: wish.save,
  deleteWish: wish.remove,

  getSpaceSession: space.getSession,
  isInSpace: space.isInSpace,
  spaceCloudStatus: space.cloudStatus,
  spaceStatusSummary: space.getStatusSummary,
  ensureSilentLogin: space.ensureSilentLogin,
  spaceLogin: space.login,
  createFamily: space.createFamily,
  createSpace: space.createSpace,
  joinSpace: space.joinSpace,
  refreshSpace: space.refreshSpace,
  leaveSpace: space.leaveSpace,
  transferOwner: space.transferOwner,
  kickMember: space.kickMember,
  dissolveSpace: space.dissolveSpace,

  ensureHomemadePlace: seed.ensureHomemadePlace,
  ensureDefaultPlace: seed.ensureDefaultPlace,
  ensureDefaultRegion: seed.ensureDefaultRegion,
  seedTestHomemade: seedSamples.seedTestHomemade,

  exportPackage: backup.exportPackage,
  importPackage: backup.importPackage,
  backupModulesLabel: backup.modulesLabel,

  syncPull: sync.pull,
  syncPushAll: sync.pushAll,
  syncFull: sync.fullSync,
  syncFlush: sync.flushQueue,
  syncCan: sync.canSync,

  getStats: stats.getStats,
  DISH_KIND
};
