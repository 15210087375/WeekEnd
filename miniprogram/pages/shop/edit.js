const domain = require('../../domain/index');
const fabReveal = require('../../behaviors/fabReveal');
const imageStore = require('../../services/imageStore');
const routes = require('../../config/routes');
const { uuid } = require('../../utils/id');
const { SHOP_CATEGORIES, SHOP_STATUS } = require('../../utils/constants');
const {
  formatDateWeekday,
  buildDatePicker,
  ymdFromPicker,
  shiftDatePicker
} = require('../../utils/format');

const MAX_IMAGES = 6;

function todayStr() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

Page({
  behaviors: [fabReveal],
  data: {
    id: '',
    storeName: '',
    title: '',
    amountText: '',
    date: '',
    dateText: '',
    dateRange: [[], [], [], []],
    dateIndex: [0, 0, 0, 0],
    category: '',
    status: SHOP_STATUS.DONE,
    visibility: 'space',
    note: '',
    worthScore: 0,
    images: [],
    categories: SHOP_CATEGORIES,
    _ownerId: ''
  },

  onLoad(query) {
    const id = (query && query.id) || '';
    const status =
      query && query.status === SHOP_STATUS.PLANNED
        ? SHOP_STATUS.PLANNED
        : SHOP_STATUS.DONE;
    const date = (query && query.date) || todayStr();
    const storeName = (query && query.storeName) || '';
    const picker = buildDatePicker(date);
    this.setData({
      id,
      status,
      storeName,
      _ownerId: id || uuid(),
      date,
      dateText: formatDateWeekday(date),
      dateRange: picker.range,
      dateIndex: picker.index
    });
    wx.setNavigationBarTitle({
      title: id
        ? '编辑购物'
        : status === SHOP_STATUS.PLANNED
          ? '添加计划'
          : '记一笔'
    });
  },

  onShow() {
    if (!this.data.id || this._loaded) return;
    const row = domain.getShopLog(this.data.id);
    if (!row) {
      wx.showToast({ title: '记录不存在', icon: 'none' });
      return;
    }
    this._loaded = true;
    const date = row.date || todayStr();
    const picker = buildDatePicker(date);
    this.setData({
      storeName: row.storeName || '',
      title: row.title || '',
      amountText: row.amount != null ? String(row.amount) : '',
      date,
      dateText: formatDateWeekday(date),
      dateRange: picker.range,
      dateIndex: picker.index,
      category: row.category || '',
      status:
        this.data.status === SHOP_STATUS.DONE && row.status === SHOP_STATUS.PLANNED
          ? SHOP_STATUS.DONE
          : row.status || SHOP_STATUS.DONE,
      visibility: row.visibility === 'private' ? 'private' : 'space',
      note: row.note || '',
      worthScore: Number(row.worthScore) || 0,
      images: row.images || [],
      _ownerId: row.id
    });
  },

  onStoreName(e) {
    this.setData({ storeName: e.detail.value });
  },

  onTitle(e) {
    this.setData({ title: e.detail.value });
  },

  onAmount(e) {
    this.setData({ amountText: e.detail.value });
  },

  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  onDateColumn(e) {
    const col = Number(e.detail.column);
    const idx = Number(e.detail.value);
    const range = (this.data.dateRange || []).map((colRange) => colRange.slice());
    const index = (this.data.dateIndex || [0, 0, 0, 0]).slice();
    index[col] = idx;
    const next = shiftDatePicker(range, index, col);
    this.setData({ dateRange: next.range, dateIndex: next.index });
  },

  onDatePick(e) {
    const index = (e.detail.value || []).slice();
    const date = ymdFromPicker(this.data.dateRange, index);
    const picker = buildDatePicker(date);
    this.setData({
      date,
      dateText: formatDateWeekday(date),
      dateRange: picker.range,
      dateIndex: picker.index
    });
  },

  onPickStatus(e) {
    this.setData({ status: e.currentTarget.dataset.id || SHOP_STATUS.DONE });
  },

  onPickCategory(e) {
    const id = e.currentTarget.dataset.id;
    const next = this.data.category === id ? '' : id;
    this.setData({ category: next });
  },

  onPickVisibility(e) {
    this.setData({ visibility: e.currentTarget.dataset.id });
  },

  onPickStar(e) {
    const n = Number(e.detail && e.detail.value);
    this.setData({ worthScore: Number.isFinite(n) ? n : 0 });
  },

  onAddImage() {
    const remain = MAX_IMAGES - (this.data.images || []).length;
    if (remain <= 0) {
      wx.showToast({ title: `最多 ${MAX_IMAGES} 张`, icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const ownerId = this.data._ownerId;
        const added = [];
        (res.tempFiles || []).forEach((f) => {
          if (!f || !f.tempFilePath) return;
          try {
            added.push({ localPath: imageStore.persistImage(f.tempFilePath, ownerId) });
          } catch (err) {
            console.warn('[shop] persist image failed', err);
          }
        });
        if (!added.length) {
          wx.showToast({ title: '添加图片失败', icon: 'none' });
          return;
        }
        this.setData({ images: (this.data.images || []).concat(added) });
      }
    });
  },

  onRemoveImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    const images = (this.data.images || []).slice();
    const removed = images.splice(index, 1)[0];
    if (removed && removed.localPath) {
      imageStore.removeFileQuiet(removed.localPath);
    }
    this.setData({ images });
  },

  onSave() {
    try {
      const row = domain.saveShopLog({
        id: this.data.id || this.data._ownerId,
        storeName: this.data.storeName,
        title: this.data.title,
        amount: this.data.amountText,
        date: this.data.date,
        category: this.data.category,
        visibility: this.data.visibility,
        note: this.data.note,
        status: this.data.status,
        worthScore: this.data.worthScore,
        images: this.data.images
      });
      this.setData({ id: row.id });
      this._loaded = true;
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => routes.back(routes.shopList()), 400);
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' });
    }
  },

  onDelete() {
    if (!this.data.id) return;
    wx.showModal({
      title: '删除这笔',
      content: '删除后不可恢复，确定？',
      success: (res) => {
        if (!res.confirm) return;
        try {
          domain.deleteShopLog(this.data.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => routes.back(routes.shopList()), 400);
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '删除失败', icon: 'none' });
        }
      }
    });
  }
});
