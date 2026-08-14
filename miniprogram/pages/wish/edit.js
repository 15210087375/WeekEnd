const domain = require('../../domain/index');
const imageStore = require('../../services/imageStore');
const routes = require('../../config/routes');
const { uuid } = require('../../utils/id');
const {
  WISH_STATUS,
  WISH_STATUS_LABELS,
  WISH_CATEGORIES
} = require('../../utils/constants');

const STATUS_OPTIONS = [
  { id: WISH_STATUS.WANT, label: WISH_STATUS_LABELS.want },
  { id: WISH_STATUS.DOING, label: WISH_STATUS_LABELS.doing },
  { id: WISH_STATUS.DONE, label: WISH_STATUS_LABELS.done },
  { id: WISH_STATUS.DROP, label: WISH_STATUS_LABELS.drop }
];

const MAX_IMAGES = 6;

Page({
  data: {
    id: '',
    title: '',
    category: '',
    status: WISH_STATUS.WANT,
    visibility: 'space',
    note: '',
    priceText: '',
    images: [],
    categories: WISH_CATEGORIES,
    statusOptions: STATUS_OPTIONS,
    _ownerId: ''
  },

  onLoad(query) {
    const id = (query && query.id) || '';
    this.setData({
      id,
      _ownerId: id || uuid()
    });
    wx.setNavigationBarTitle({
      title: id ? '编辑心愿' : '添加心愿'
    });
  },

  onShow() {
    if (!this.data.id || this._loaded) return;
    const wish = domain.getWish(this.data.id);
    if (!wish) {
      wx.showToast({ title: '心愿不存在', icon: 'none' });
      return;
    }
    this._loaded = true;
    this.setData({
      title: wish.title || '',
      category: wish.category || '',
      status: wish.status || WISH_STATUS.WANT,
      visibility: wish.visibility === 'private' ? 'private' : 'space',
      note: wish.note || '',
      priceText: wish.priceRef != null ? String(wish.priceRef) : '',
      images: wish.images || [],
      _ownerId: wish.id
    });
  },

  onTitle(e) {
    this.setData({ title: e.detail.value });
  },

  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  onPrice(e) {
    this.setData({ priceText: e.detail.value });
  },

  onPickCategory(e) {
    const name = e.currentTarget.dataset.name;
    const next = this.data.category === name ? '' : name;
    this.setData({ category: next });
  },

  onPickStatus(e) {
    this.setData({ status: e.currentTarget.dataset.id });
  },

  onPickVisibility(e) {
    this.setData({ visibility: e.currentTarget.dataset.id });
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
            console.warn('[wish] persist image failed', err);
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
      // 新建时用 _ownerId，保证已落盘图片目录与记录 id 一致
      const row = domain.saveWish({
        id: this.data.id || this.data._ownerId,
        title: this.data.title,
        category: this.data.category,
        status: this.data.status,
        visibility: this.data.visibility,
        note: this.data.note,
        priceRef: this.data.priceText,
        images: this.data.images
      });
      this.setData({ id: row.id });
      this._loaded = true;
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => routes.back(routes.wishList()), 400);
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' });
    }
  },

  onDelete() {
    if (!this.data.id) return;
    wx.showModal({
      title: '删除心愿',
      content: '删除后不可恢复，确定？',
      success: (res) => {
        if (!res.confirm) return;
        try {
          domain.deleteWish(this.data.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => routes.back(routes.wishList()), 400);
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '删除失败', icon: 'none' });
        }
      }
    });
  }
});
