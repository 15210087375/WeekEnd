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
const cinema = require('./cinema');
const moviePlan = require('./moviePlan');
const movieLog = require('./movieLog');
const shop = require('./shop');
const note = require('./note');
const schedule = require('./schedule');
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
  // 我的菜谱：剔除历史同名冗余（保留最新）
  try {
    dish.purgeHomemadeNameDupes();
  } catch (e) {
    // ignore
  }
  try {
    cloud.init();
  } catch (e) {
    console.warn('[domain] cloud.init skip', e);
  }
  try {
    if (space.isInSpace()) {
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
  purgeHomemadeNameDupes: dish.purgeHomemadeNameDupes,
  isHomemadeNameTaken: dish.isHomemadeNameTaken,

  listOrders: order.list,
  listPreorders: order.listPreorders,
  listOpenOrders: order.listOpen,
  getOrder: order.get,
  createOrder: order.create,
  saveOrder: order.save,
  deleteOrder: order.remove,
  setOrderStatus: order.setStatus,
  orderCanTransition: order.canTransition,
  orderTransition: order.transition,
  setOrderMealDate: order.setMealDate,
  setOrderSchedule: order.setSchedule,
  mealSlotLabel: order.mealSlotLabel,
  scheduleText: order.scheduleText,
  encodeOrderShare: order.encodeShareQuery,
  parseOrderShare: order.parseShareQuery,
  orderShareText: order.toShareText,
  collectOrderMaterials: order.collectMaterials,
  ORDER_STATUS: order.ORDER_STATUS,
  ORDER_STATUS_LABELS: order.ORDER_STATUS_LABELS,
  orderToday: order.todayStr,

  cartSnapshot: cart.snapshot,
  cartCount: cart.count,
  cartHas: cart.has,
  cartToggle: cart.toggle,
  cartAdd: cart.add,
  cartAddCustom: cart.addCustom,
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
  cartSetSchedule: cart.setActiveSchedule,
  cartMarkCooking: cart.markCooking,
  cartListPreorders: cart.listPreorders,

  listWishes: wish.list,
  getWish: wish.get,
  saveWish: wish.save,
  deleteWish: wish.remove,

  listCinemas: cinema.listCinemas,
  getCinema: cinema.getCinema,
  saveCinema: cinema.saveCinema,
  deleteCinema: cinema.removeCinema,
  listCinemaHalls: cinema.listHalls,
  getCinemaHall: cinema.getHall,
  saveCinemaHall: cinema.saveHall,
  deleteCinemaHall: cinema.removeHall,

  listMoviePlans: moviePlan.list,
  getMoviePlan: moviePlan.get,
  saveMoviePlan: moviePlan.save,
  deleteMoviePlan: moviePlan.remove,

  listMovieLogs: movieLog.list,
  getMovieLog: movieLog.get,
  getMovieLogByPlan: movieLog.getByPlanId,
  saveMovieLog: movieLog.save,
  deleteMovieLog: movieLog.remove,

  listShopLogs: shop.list,
  getShopLog: shop.get,
  saveShopLog: shop.save,
  deleteShopLog: shop.remove,
  summarizeShopLogs: shop.summarize,

  listNotes: note.list,
  getNote: note.get,
  saveNote: note.save,
  deleteNote: note.remove,

  listSchedules: schedule.list,
  getSchedule: schedule.get,
  saveSchedule: schedule.save,
  deleteSchedule: schedule.remove,
  scheduleToday: schedule.todayYmd,

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
  setMemberTag: space.setMemberTag,
  isCook: space.isCook,
  isEaterOnly: space.isEaterOnly,

  ensureHomemadePlace: seed.ensureHomemadePlace,
  ensureDefaultPlace: seed.ensureDefaultPlace,
  ensureDefaultRegion: seed.ensureDefaultRegion,
  seedTestHomemade: seedSamples.seedTestHomemade,

  exportPackage: backup.exportPackage,
  importPackage: backup.importPackage,
  backupModulesLabel: backup.modulesLabel,

  syncPull: sync.pull,
  /** 页面同步只调此入口：{ reason, buckets, force } */
  syncRefresh: sync.refresh,
  syncPushAll: sync.pushAll,
  syncFull: sync.fullSync,
  syncFlush: sync.flushQueue,
  syncCan: sync.canSync,

  getStats: stats.getStats,
  DISH_KIND
};
