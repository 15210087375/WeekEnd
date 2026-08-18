const domain = require('../../domain/index');
const fabReveal = require('../../behaviors/fabReveal');
const imageStore = require('../../services/imageStore');
const routes = require('../../config/routes');
const { uuid } = require('../../utils/id');
const { NOTE_TAGS } = require('../../utils/constants');
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
    title: '',
    body: '',
    date: '',
    dateText: '',
    dateRange: [[], [], [], []],
    dateIndex: [0, 0, 0, 0],
    tag: '',
    visibility: 'private',
    images: [],
    tags: NOTE_TAGS,
    _ownerId: ''
  },

  onLoad(query) {
    const id = (query && query.id) || '';
    const today = todayStr();
    const picker = buildDatePicker(today);
    this.setData({
      id,
      _ownerId: id || uuid(),
      date: today,
      dateText: formatDateWeekday(today),
      dateRange: picker.range,
      dateIndex: picker.index,
      visibility: 'private'
    });
    wx.setNavigationBarTitle({
      title: id ? '编辑随笔' : '记一条'
    });
  },

  onShow() {
    if (!this.data.id || this._loaded) return;
    const row = domain.getNote(this.data.id);
    if (!row) {
      wx.showToast({ title: '随笔不存在', icon: 'none' });
      return;
    }
    this._loaded = true;
    const date = row.date || todayStr();
    const picker = buildDatePicker(date);
    this.setData({
      title: row.title || '',
      body: row.body || '',
      date,
      dateText: formatDateWeekday(date),
      dateRange: picker.range,
      dateIndex: picker.index,
      tag: row.tag || '',
      visibility: row.visibility === 'space' ? 'space' : 'private',
      images: row.images || [],
      _ownerId: row.id
    });
  },

  onTitle(e) {
    this.setData({ title: e.detail.value });
  },

  onBody(e) {
    this.setData({ body: e.detail.value });
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

  onPickTag(e) {
    const id = e.currentTarget.dataset.id;
    const next = this.data.tag === id ? '' : id;
    this.setData({ tag: next });
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
            console.warn('[note] persist image failed', err);
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
      const row = domain.saveNote({
        id: this.data.id || this.data._ownerId,
        title: this.data.title,
        body: this.data.body,
        date: this.data.date,
        tag: this.data.tag,
        visibility: this.data.visibility,
        images: this.data.images
      });
      this.setData({ id: row.id });
      this._loaded = true;
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => routes.back(routes.noteList()), 400);
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' });
    }
  },

  onDelete() {
    if (!this.data.id) return;
    wx.showModal({
      title: '删除这条',
      content: '删除后不可恢复，确定？',
      success: (res) => {
        if (!res.confirm) return;
        try {
          domain.deleteNote(this.data.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => routes.back(routes.noteList()), 400);
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '删除失败', icon: 'none' });
        }
      }
    });
  }
});
