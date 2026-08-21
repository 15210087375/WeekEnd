const domain = require('../../domain/index');
const routes = require('../../config/routes');
const search = require('../../domain/search');

const RECENT_KEY = 'omniboxRecent';
const RECENT_MAX = 10;

function loadRecent() {
  try {
    const rows = wx.getStorageSync(RECENT_KEY);
    return Array.isArray(rows) ? rows.filter((x) => String(x).trim()) : [];
  } catch (e) {
    return [];
  }
}

function saveRecent(q) {
  const t = String(q || '').trim();
  if (!t) return loadRecent();
  let rows = loadRecent().filter((x) => x !== t);
  rows.unshift(t);
  rows = rows.slice(0, RECENT_MAX);
  try {
    wx.setStorageSync(RECENT_KEY, rows);
  } catch (e) {
    // ignore
  }
  return rows;
}

Page({
  data: {
    keyword: '',
    focus: true,
    recent: [],
    features: [],
    result: { groups: [], empty: false },
    expanded: {}
  },

  onLoad(query) {
    const keyword = query && query.q ? decodeURIComponent(query.q) : '';
    this.setData({
      keyword,
      recent: loadRecent(),
      features: search.listFeatures()
    });
    if (keyword) this.run(keyword, true);
  },

  onInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    clearTimeout(this._t);
    this._t = setTimeout(() => this.run(keyword, false), 200);
  },

  onConfirm(e) {
    const keyword = (e.detail && e.detail.value) || this.data.keyword;
    this.setData({ keyword });
    this.run(keyword, true);
  },

  onClear() {
    this.setData({
      keyword: '',
      result: { groups: [], empty: false },
      expanded: {}
    });
  },

  onClearRecent() {
    try {
      wx.removeStorageSync(RECENT_KEY);
    } catch (e) {
      // ignore
    }
    this.setData({ recent: [] });
  },

  onRecent(e) {
    const q = e.currentTarget.dataset.q || '';
    this.setData({ keyword: q });
    this.run(q, true);
  },

  onMore(e) {
    const id = e.currentTarget.dataset.id;
    const expanded = { ...(this.data.expanded || {}) };
    expanded[id] = !expanded[id];
    this.setData({ expanded }, () => this.run(this.data.keyword, false));
  },

  run(raw, remember) {
    const q = String(raw || '').trim();
    if (!q) {
      this.setData({ result: { groups: [], empty: false } });
      return;
    }
    const result = search.searchAll(q, { expanded: this.data.expanded || {} });
    this.setData({ result });
    if (remember) {
      this.setData({ recent: saveRecent(q) });
    }
  },

  onHit(e) {
    const gid = e.currentTarget.dataset.gid;
    const type = e.currentTarget.dataset.type;
    const index = Number(e.currentTarget.dataset.index);
    let item;
    if (!this.data.keyword) {
      item = (this.data.features || [])[index];
    } else {
      const g = (this.data.result.groups || []).find((x) => x.id === gid || x.id === type);
      item = g && g.hits ? g.hits[index] : null;
    }
    if (!item || !item.go) return;
    if (this.data.keyword) saveRecent(this.data.keyword);
    this.goHit(item.go);
  },

  goHit(go) {
    const k = go.kind;
    if (k === 'dishDetail') return routes.go(routes.dishDetail(go.id));
    if (k === 'placeDetail') return routes.go(routes.placeDetail(go.id));
    if (k === 'wishList') return routes.go(routes.wishList());
    if (k === 'wishEdit') return routes.go(routes.wishEdit({ id: go.id }));
    if (k === 'shopList') return routes.go(routes.shopList());
    if (k === 'shopEdit') return routes.go(routes.shopEdit({ id: go.id }));
    if (k === 'noteList') return routes.go(routes.noteList());
    if (k === 'noteEdit') return routes.go(routes.noteEdit({ id: go.id }));
    if (k === 'scheduleDay') return routes.go(routes.scheduleDay());
    if (k === 'scheduleEdit') {
      return routes.go(routes.scheduleEdit({ id: go.id, date: go.date }));
    }
    if (k === 'watch') return routes.go(routes.watch({ tab: go.tab || 'plan' }));
    if (k === 'moviePlanEdit') return routes.go(routes.moviePlanEdit({ id: go.id }));
    if (k === 'movieLogEdit') return routes.go(routes.movieLogEdit({ id: go.id }));
    if (k === 'cinemaDetail') return routes.go(routes.cinemaDetail(go.id));
    if (k === 'orderList') return routes.go(routes.orderList());
    if (k === 'orderDetail') return routes.go(routes.orderDetail(go.id));
    if (k === 'archiveList') return routes.go(routes.archiveList(go.dishKind));
  }
});
