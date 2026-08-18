/**
 * 路由表：页面跳转只经此模块，避免 path 散落难改。
 * 观影链路优先走娱乐页内层（funStack）。
 */
const { DISH_KIND } = require('../utils/constants');
const funStack = require('../utils/funStack');

const PATH = {
  home: '/pages/home/index',
  fun: '/pages/fun/index',
  browse: '/pages/search/index', // 原浏览并入搜索-目录
  search: '/pages/search/index',
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

  wishEdit({ id } = {}) {
    return PATH.wishEdit + qs({ id });
  },

  shopList() {
    return PATH.shopList;
  },

  shopEdit({ id } = {}) {
    return PATH.shopEdit + qs({ id });
  },

  noteList() {
    return PATH.noteList;
  },

  noteEdit({ id } = {}) {
    return PATH.noteEdit + qs({ id });
  },

  cinemaList() {
    return PATH.watch + qs({ tab: 'cinema' });
  },

  watch({ tab } = {}) {
    return PATH.watch + qs({ tab });
  },

  moviePlanEdit({ id } = {}) {
    return PATH.moviePlanEdit + qs({ id });
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
    if (tryFunLayer(url, false)) return;
    wx.navigateTo({ url });
  },

  redirect(url) {
    if (tryFunLayer(url, true)) return;
    wx.redirectTo({ url });
  },

  back(fallbackUrl) {
    if (funStack.pop()) return;
    wx.navigateBack({
      fail: () => {
        if (fallbackUrl) {
          if (tryFunLayer(fallbackUrl, false)) return;
          wx.redirectTo({ url: fallbackUrl });
        }
      }
    });
  }
};

function parseQuery(url) {
  const q = {};
  const raw = String(url || '').split('?')[1] || '';
  raw.split('&').forEach((part) => {
    if (!part) return;
    const i = part.indexOf('=');
    const k = decodeURIComponent(i >= 0 ? part.slice(0, i) : part);
    const v = decodeURIComponent(i >= 0 ? part.slice(i + 1) : '');
    if (k) q[k] = v;
  });
  return q;
}

function matchFunLayer(url) {
  const path = String(url || '').split('?')[0];
  const q = parseQuery(url);
  if (path === PATH.watch || path === PATH.cinemaList) {
    return {
      name: 'watch',
      params: { tab: q.tab || 'plan' },
      title: '观影'
    };
  }
  if (path === PATH.moviePlanEdit) {
    return {
      name: 'watchPlan',
      params: { id: q.id || '' },
      title: q.id ? '编辑片子' : '添加片子'
    };
  }
  if (path === PATH.movieLogEdit) {
    return {
      name: 'watchRecord',
      params: { id: q.id || '', planId: q.planId || '' },
      title: q.id ? '编辑观影记录' : '写观影记录'
    };
  }
  if (path === PATH.cinemaDetail) {
    return {
      name: 'cinemaDetail',
      params: { id: q.id || '' },
      title: '影院'
    };
  }
  if (path === PATH.cinemaEdit) {
    return {
      name: 'cinemaEdit',
      params: { id: q.id || '' },
      title: q.id ? '编辑影院' : '添加影院'
    };
  }
  if (path === PATH.cinemaHall) {
    return {
      name: 'cinemaHall',
      params: { id: q.id || '', cinemaId: q.cinemaId || '' },
      title: q.id ? '编辑厅' : '添加厅'
    };
  }
  return null;
}

function tryFunLayer(url, replace) {
  const layer = matchFunLayer(url);
  if (!layer) return false;
  if (funStack.canUse()) {
    if (replace) funStack.replace(layer.name, layer.params, layer.title);
    else funStack.push(layer.name, layer.params, layer.title);
    return true;
  }
  funStack.openOrSwitch(layer.name, layer.params, layer.title);
  return true;
}

module.exports = routes;
