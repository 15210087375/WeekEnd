const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { uuid } = require('../../utils/id');
const pickImages = require('../../utils/pickImages');
const fabReveal = require('../../behaviors/fabReveal');

Page({
  behaviors: [fabReveal],
  data: {
    id: '',
    cinemaId: '',
    cinemaName: '',
    name: '',
    bestRow: '',
    note: '',
    images: [],
    _ownerId: ''
  },

  onLoad(query) {
    const id = (query && query.id) || '';
    const cinemaId = (query && query.cinemaId) || '';
    let cinemaName = '';
    if (id) {
      const hall = domain.getCinemaHall(id);
      if (!hall) {
        wx.showToast({ title: '厅不存在', icon: 'none' });
        return;
      }
      const cinema = domain.getCinema(hall.cinemaId);
      cinemaName = cinema ? cinema.name : '';
      this.setData({
        id,
        cinemaId: hall.cinemaId,
        cinemaName,
        name: hall.name || '',
        bestRow: hall.bestRow || '',
        note: hall.note || '',
        images: hall.images || [],
        _ownerId: id
      });
    } else {
      const cinema = domain.getCinema(cinemaId);
      cinemaName = cinema ? cinema.name : '';
      this.setData({ cinemaId, cinemaName, _ownerId: uuid() });
    }
    wx.setNavigationBarTitle({
      title: id ? '编辑厅' : '添加厅'
    });
  },

  onName(e) {
    this.setData({ name: e.detail.value });
  },

  onBestRow(e) {
    this.setData({ bestRow: e.detail.value });
  },

  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  onAddShot() {
    pickImages.chooseScreenshots({
      images: this.data.images,
      ownerId: this.data._ownerId,
      onDone: (images) => this.setData({ images })
    });
  },

  onPreviewShot(e) {
    pickImages.previewImages(this.data.images, Number(e.currentTarget.dataset.index));
  },

  onRemoveShot(e) {
    this.setData({
      images: pickImages.removeAt(this.data.images, Number(e.currentTarget.dataset.index))
    });
  },

  onSave() {
    try {
      domain.saveCinemaHall({
        id: this.data.id || this.data._ownerId,
        cinemaId: this.data.cinemaId,
        name: this.data.name,
        bestRow: this.data.bestRow,
        note: this.data.note,
        images: this.data.images
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => routes.back(routes.cinemaDetail(this.data.cinemaId)), 350);
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' });
    }
  },

  onDelete() {
    if (!this.data.id) return;
    wx.showModal({
      title: '删除厅',
      content: '删除后不可恢复。',
      success: (res) => {
        if (!res.confirm) return;
        try {
          const cinemaId = this.data.cinemaId;
          domain.deleteCinemaHall(this.data.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => routes.back(routes.cinemaDetail(cinemaId)), 350);
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '删除失败', icon: 'none' });
        }
      }
    });
  }
});
