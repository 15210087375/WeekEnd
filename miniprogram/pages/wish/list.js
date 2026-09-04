const domain = require('../../domain/index');
const routes = require('../../config/routes');
const fabReveal = require('../../behaviors/fabReveal');
const imageStore = require('../../services/imageStore');
const pickImages = require('../../utils/pickImages');
const { formatDateTime } = require('../../utils/format');
const {
  WISH_STATUS,
  WISH_STATUS_LABELS,
  WISH_CATEGORIES
} = require('../../utils/constants');
const { FOOD_CATEGORIES } = require('../../config/categories');

const CATEGORY_LABEL = {};
WISH_CATEGORIES.forEach((c) => {
  CATEGORY_LABEL[c.id] = c.name;
  CATEGORY_LABEL[c.name] = c.name;
});
FOOD_CATEGORIES.forEach((c) => {
  CATEGORY_LABEL[c.id] = c.label;
  CATEGORY_LABEL[c.label] = c.label;
});

function categoryLabel(raw) {
  const key = String(raw || '').trim();
  if (!key) return '';
  if (CATEGORY_LABEL[key]) return CATEGORY_LABEL[key];
  if (/^[a-z0-9_]+$/i.test(key)) return '';
  return key;
}

const FILTER_ALL = 'all';

const FILTERS = [
  { id: FILTER_ALL, label: '全部' },
  { id: WISH_STATUS.WANT, label: WISH_STATUS_LABELS.want },
  { id: WISH_STATUS.DONE, label: WISH_STATUS_LABELS.done },
  { id: WISH_STATUS.DROP, label: WISH_STATUS_LABELS.drop }
];



const STATUS_CHIPS = [
  { id: WISH_STATUS.WANT, label: WISH_STATUS_LABELS.want },
  { id: WISH_STATUS.DONE, label: WISH_STATUS_LABELS.done },
  { id: WISH_STATUS.DROP, label: WISH_STATUS_LABELS.drop }
];

Page({
  behaviors: [fabReveal],
  data: {
    filters: FILTERS,
    statusChips: STATUS_CHIPS,
    filterStatus: FILTER_ALL,
    list: [],
    empty: true,
    expandedId: ''
  },

  onShow() {
    this.reload();
  },

  reload() {
    const filterStatus = this.data.filterStatus;
    const filter =
      filterStatus && filterStatus !== FILTER_ALL ? { status: filterStatus } : {};
    const list = domain.listWishes(filter).map((w) => {
      const images = imageStore.forView(w.images);
      return {
        ...w,
        images,
        timeText: formatDateTime(w.updatedAt),
        categoryLabel: categoryLabel(w.category),
        thumb: images[0] ? images[0].src : '',
        isPrivate: w.visibility === 'private'
      };
    });
    const expandedId = this.data.expandedId;
    const still = expandedId && list.some((w) => w.id === expandedId);
    this.setData({
      list,
      empty: !list.length,
      expandedId: still ? expandedId : ''
    });
  },

  onFilter(e) {
    const id = e.currentTarget.dataset.id || FILTER_ALL;
    this.setData({ filterStatus: String(id), expandedId: '' }, () => this.reload());
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      expandedId: this.data.expandedId === id ? '' : id
    });
  },

  patchWish(id, extra) {
    const row = domain.getWish(id);
    if (!row) return;
    domain.saveWish({
      id: row.id,
      title: row.title,
      category: row.category,
      status: row.status,
      visibility: row.visibility,
      note: row.note,
      priceRef: row.priceRef,
      images: row.images,
      wantScore: row.wantScore,
      doneScore: row.doneScore,
      ...extra
    });
    this.reload();
  },

  onPickStatus(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    if (!id || !status) return;
    try {
      this.patchWish(id, { status });
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '更新失败', icon: 'none' });
    }
  },

  onPickStar(e) {
    const id = e.currentTarget.dataset.id;
    const field = e.currentTarget.dataset.field;
    const n = Number(e.detail && e.detail.value);
    if (!id || (field !== 'wantScore' && field !== 'doneScore')) return;
    const row = domain.getWish(id);
    if (!row) return;
    const next = Number.isFinite(n) ? n : 0;
    try {
      this.patchWish(id, { [field]: next });
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '更新失败', icon: 'none' });
    }
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    routes.go(routes.wishEdit({ id }));
  },

  onPreview(e) {
    pickImages.previewFromList(this.data.list, e);
  },

  goCreate() {
    routes.go(routes.wishEdit());
  },

  noop() {}
});
