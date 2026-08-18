const domain = require('../../domain/index');
const routes = require('../../config/routes');
const fabReveal = require('../../behaviors/fabReveal');
const { formatDateWeekday } = require('../../utils/format');
const { SHOP_CATEGORIES } = require('../../utils/constants');

const FILTER_ALL = 'all';
const FILTERS = [
  { id: FILTER_ALL, label: '全部' },
  { id: 'month:this', label: '本月' },
  { id: 'month:last', label: '上月' }
].concat(SHOP_CATEGORIES.map((c) => ({ id: `cat:${c.id}`, label: c.name })));

function parseFilter(id) {
  const raw = String(id || FILTER_ALL);
  if (raw === 'month:this') return { month: 'this' };
  if (raw === 'month:last') return { month: 'last' };
  if (raw.indexOf('cat:') === 0) return { category: raw.slice(4) };
  return {};
}

Page({
  behaviors: [fabReveal],
  data: {
    filters: FILTERS,
    categories: SHOP_CATEGORIES,
    filterId: FILTER_ALL,
    list: [],
    empty: true,
    expandedId: '',
    summaryText: ''
  },

  onShow() {
    this.reload();
  },

  reload() {
    const filter = parseFilter(this.data.filterId);
    const list = domain.listShopLogs(filter).map((row) => ({
      ...row,
      dateText: formatDateWeekday(row.date),
      imageUrls: (row.images || []).map((img) => img.localPath).filter(Boolean),
      isPrivate: row.visibility === 'private'
    }));
    const sum = domain.summarizeShopLogs(list);
    const expandedId = this.data.expandedId;
    const still = expandedId && list.some((w) => w.id === expandedId);
    this.setData({
      list,
      empty: !list.length,
      summaryText: sum.summaryText,
      expandedId: still ? expandedId : ''
    });
  },

  onFilter(e) {
    const id = e.currentTarget.dataset.id || FILTER_ALL;
    this.setData({ filterId: String(id), expandedId: '' }, () => this.reload());
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      expandedId: this.data.expandedId === id ? '' : id
    });
  },

  patchLog(id, extra) {
    const row = domain.getShopLog(id);
    if (!row) return;
    domain.saveShopLog({
      id: row.id,
      storeName: row.storeName,
      title: row.title,
      amount: row.amount,
      date: row.date,
      category: row.category,
      note: row.note,
      worthScore: row.worthScore,
      images: row.images,
      visibility: row.visibility,
      ...extra
    });
    this.reload();
  },

  onPickCategory(e) {
    const id = e.currentTarget.dataset.id;
    const category = e.currentTarget.dataset.category || '';
    if (!id) return;
    const row = domain.getShopLog(id);
    if (!row) return;
    const next = row.category === category ? '' : category;
    try {
      this.patchLog(id, { category: next });
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '更新失败', icon: 'none' });
    }
  },

  onPickStar(e) {
    const id = e.currentTarget.dataset.id;
    const n = Number(e.detail && e.detail.value);
    if (!id) return;
    try {
      this.patchLog(id, { worthScore: Number.isFinite(n) ? n : 0 });
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '更新失败', icon: 'none' });
    }
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    routes.go(routes.shopEdit({ id }));
  },

  onPreview(e) {
    const urls = e.currentTarget.dataset.urls || [];
    const current = e.currentTarget.dataset.current || urls[0];
    if (!urls.length) return;
    wx.previewImage({ current, urls });
  },

  goCreate() {
    routes.go(routes.shopEdit());
  }
});
