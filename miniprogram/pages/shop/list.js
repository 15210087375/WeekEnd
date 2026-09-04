const domain = require('../../domain/index');
const routes = require('../../config/routes');
const fabReveal = require('../../behaviors/fabReveal');
const imageStore = require('../../services/imageStore');
const pickImages = require('../../utils/pickImages');
const { formatDateWeekday } = require('../../utils/format');
const { SHOP_CATEGORIES, SHOP_STATUS } = require('../../utils/constants');

const FILTER_ALL = 'all';
const FILTERS = [
  { id: FILTER_ALL, label: '全部' },
  { id: 'status:planned', label: '计划' },
  { id: 'status:done', label: '已买' },
  { id: 'month:this', label: '本月' },
  { id: 'month:last', label: '上月' }
].concat(SHOP_CATEGORIES.map((c) => ({ id: `cat:${c.id}`, label: c.name })));

function parseFilter(id) {
  const raw = String(id || FILTER_ALL);
  if (raw === 'month:this') return { month: 'this' };
  if (raw === 'month:last') return { month: 'last' };
  if (raw === 'status:planned') return { status: SHOP_STATUS.PLANNED };
  if (raw === 'status:done') return { status: SHOP_STATUS.DONE };
  if (raw.indexOf('cat:') === 0) return { category: raw.slice(4) };
  return {};
}

Page({
  behaviors: [fabReveal],
  data: {
    filters: FILTERS,
    categories: SHOP_CATEGORIES,
    filterId: FILTER_ALL,
    fabLabel: '记一笔',
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
      images: imageStore.forView(row.images),
      dateText: formatDateWeekday(row.date),
      isPrivate: row.visibility === 'private'
    }));
    const planned = filter.status === SHOP_STATUS.PLANNED;
    const sum = planned
      ? {
          summaryText: list.length ? `${list.length} 条计划` : '还没有购物计划'
        }
      : domain.summarizeShopLogs(
          list.filter((r) => r.status !== SHOP_STATUS.PLANNED)
        );
    const expandedId = this.data.expandedId;
    const still = expandedId && list.some((w) => w.id === expandedId);
    this.setData({
      list,
      empty: !list.length,
      summaryText: sum.summaryText,
      fabLabel: planned ? '添加计划' : '记一笔',
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
      status: row.status,
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
    pickImages.previewFromList(this.data.list, e);
  },

  markDone(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    routes.go(routes.shopEdit({ id, status: SHOP_STATUS.DONE }));
  },

  goCreate() {
    const filter = parseFilter(this.data.filterId);
    routes.go(
      routes.shopEdit({
        status:
          filter.status === SHOP_STATUS.PLANNED
            ? SHOP_STATUS.PLANNED
            : SHOP_STATUS.DONE
      })
    );
  }
});
