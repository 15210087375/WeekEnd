/**
 * 路由表：页面跳转只经此模块，避免 path 散落难改。
 * 非 Tab 页一律 navigateTo，侧滑/返回走页面栈回到上一级。
 */
const { DISH_KIND } = require('../utils/constants');

const PATH = {
  home: '/pages/home/index',
  fun: '/pages/fun/index',
  browse: '/pages/search/index', // 原浏览并入搜索-目录
  search: '/pages/search/index',
  find: '/pages/find/index',
  mine: '/pages/mine/index',
  archiveList: '/pages/archive/list',
  historyList: '/pages/history/list',
  backup: '/pages/backup/index',
  orderList: '/pages/order/list',
  orderDetail: '/pages/order/detail',
  orderShare: '/pages/order/share',
  orderSchedule: '/pages/order/schedule',
  orderChef: '/pages/order/chef',
  dishDetail: '/pages/dish/detail',
  dishEdit: '/pages/dish/edit',
  placeDetail: '/pages/place/detail',
  placeEdit: '/pages/place/edit',
  regionEdit: '/pages/region/edit',
  mallEdit: '/pages/mall/edit',
  wishList: '/pages/wish/list',
  wishEdit: '/pages/wish/edit',
  shopList: '/pages/shop/list',
  shopEdit: '/pages/shop/edit',
  noteList: '/pages/note/list',
  noteEdit: '/pages/note/edit',
  scheduleDay: '/pages/schedule/day',
  scheduleEdit: '/pages/schedule/edit',
  cinemaList: '/pages/cinema/list',
  cinemaDetail: '/pages/cinema/detail',
  cinemaEdit: '/pages/cinema/edit',
  cinemaHall: '/pages/cinema/hall',
  watch: '/pages/watch/index',
  moviePlanEdit: '/pages/watch/plan',
  movieLogEdit: '/pages/watch/record',
  space: '/pages/space/index'
};

function qs(params) {
  const parts = [];
  Object.keys(params || {}).forEach((k) => {
    const v = params[k];
    if (v === undefined || v === null || v === '') return;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

const routes = {
  PATH,

  archiveList(kind, extra) {
    return (
      PATH.archiveList +
      qs({ kind: kind || DISH_KIND.DINE_OUT, ...(extra || {}) })
    );
  },

  find({ q } = {}) {
    return PATH.find + qs({ q });
  },

  historyList() {
    return PATH.historyList;
  },

  backup() {
    return PATH.backup;
  },

  orderList() {
    return PATH.orderList;
  },

  orderDetail(id) {
    return PATH.orderDetail + qs({ id });
  },

  orderShare(query) {
    return PATH.orderShare + qs(query || {});
  },

  /**
   * 订单日期+餐次选择
   * @param {{ id?: string, mode?: 'create'|'edit' }} [opts]
   */
  orderSchedule({ id, mode } = {}) {
    return PATH.orderSchedule + qs({ id, mode: mode || (id ? 'edit' : 'create') });
  },

  /** 厨师操作台：制作中 / 已就餐 / 材料清单 */
  orderChef(id) {
    return PATH.orderChef + qs({ id });
  },

  dishDetail(id) {
    return PATH.dishDetail + qs({ id });
  },

  dishEdit({ id, kind, placeId } = {}) {
    return PATH.dishEdit + qs({ id, kind, placeId });
  },

  placeDetail(id) {
    return PATH.placeDetail + qs({ id });
  },

  placeEdit({ id, regionId, mallId } = {}) {
    return PATH.placeEdit + qs({ id, regionId, mallId });
  },

  regionEdit() {
    return PATH.regionEdit;
  },

  mallEdit({ id, regionId } = {}) {
    return PATH.mallEdit + qs({ id, regionId });
  },

  wishList() {
    return PATH.wishList;
  },

  wishEdit({ id, title, note, from, date } = {}) {
    return PATH.wishEdit + qs({ id, title, note, from, date });
  },

  shopList() {
    return PATH.shopList;
  },

  shopEdit({ id, status, date, storeName } = {}) {
    return PATH.shopEdit + qs({ id, status, date, storeName });
  },

  noteList() {
    return PATH.noteList;
  },

  noteEdit({ id, date, title, body, from } = {}) {
    return PATH.noteEdit + qs({ id, date, title, body, from });
  },

  scheduleDay({ date } = {}) {
    return PATH.scheduleDay + qs({ date });
  },

  scheduleEdit({ id, date } = {}) {
    return PATH.scheduleEdit + qs({ id, date });
  },

  cinemaList() {
    return PATH.watch + qs({ tab: 'cinema' });
  },

  watch({ tab } = {}) {
    return PATH.watch + qs({ tab });
  },

  moviePlanEdit({ id, date, title, from } = {}) {
    return PATH.moviePlanEdit + qs({ id, date, title, from });
  },

  movieLogEdit({ id, planId } = {}) {
    return PATH.movieLogEdit + qs({ id, planId });
  },

  cinemaDetail(id) {
    return PATH.cinemaDetail + qs({ id });
  },

  cinemaEdit({ id } = {}) {
    return PATH.cinemaEdit + qs({ id });
  },

  cinemaHall({ id, cinemaId } = {}) {
    return PATH.cinemaHall + qs({ id, cinemaId });
  },

  space() {
    return PATH.space;
  },

  go(url) {
    wx.navigateTo({ url });
  },

  redirect(url) {
    wx.redirectTo({ url });
  },

  back(fallbackUrl) {
    wx.navigateBack({
      fail: () => {
        if (fallbackUrl) wx.redirectTo({ url: fallbackUrl });
      }
    });
  },

  /** 从日程跳过来的业务页保存后：回到当天，不要回到「编辑日程」 */
  finishScheduleFlow(date) {
    const dayUrl = PATH.scheduleDay + qs({ date });
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const prev = pages.length >= 2 ? pages[pages.length - 2] : null;
    const route = String((prev && (prev.route || prev.__route__)) || '');
    if (route.indexOf('schedule/edit') >= 0) {
      wx.navigateBack({
        delta: Math.min(2, Math.max(1, pages.length - 1)),
        fail: () => wx.redirectTo({ url: dayUrl })
      });
      return;
    }
    if (route.indexOf('schedule/day') >= 0) {
      wx.navigateBack({
        fail: () => wx.redirectTo({ url: dayUrl })
      });
      return;
    }
    wx.redirectTo({ url: dayUrl });
  }
};

module.exports = routes;
