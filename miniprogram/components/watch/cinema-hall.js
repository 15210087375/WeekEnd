const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { uuid } = require('../../utils/id');
const pickImages = require('../../utils/pickImages');

Component({
  properties: {
    hallId: { type: String, value: '' },
    cinemaId: { type: String, value: '' }
  },
  data: {
    id: '',
    cinemaName: '',
    name: '',
    bestRow: '',
    note: '',
    images: [],
    _ownerId: ''
  },
  lifetimes: {
    attached() {
      const id = this.data.hallId || '';
      const cinemaId = this.data.cinemaId || '';
      if (id) {
        const hall = domain.getCinemaHall(id);
        if (!hall) {
          wx.showToast({ title: '厅不存在', icon: 'none' });
          return;
        }
        const cinema = domain.getCinema(hall.cinemaId);
        this.setData({
          id,
          cinemaId: hall.cinemaId,
          cinemaName: cinema ? cinema.name : '',
          name: hall.name || '',
          bestRow: hall.bestRow || '',
          note: hall.note || '',
          images: hall.images || [],
          _ownerId: id
        });
        return;
      }
      const cinema = domain.getCinema(cinemaId);
      this.setData({
        cinemaId,
        cinemaName: cinema ? cinema.name : '',
        _ownerId: uuid()
      });
    }
  },
  methods: {
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
        setTimeout(() => routes.back(), 350);
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
            domain.deleteCinemaHall(this.data.id);
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => routes.back(), 350);
          } catch (e) {
            wx.showToast({ title: (e && e.message) || '删除失败', icon: 'none' });
          }
        }
      });
    }
  }
});
