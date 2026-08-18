const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { uuid } = require('../../utils/id');
const pickImages = require('../../utils/pickImages');

Component({
  properties: {
    cinemaId: { type: String, value: '' }
  },
  data: {
    id: '',
    name: '',
    note: '',
    images: [],
    _ownerId: ''
  },
  lifetimes: {
    attached() {
      const id = this.data.cinemaId || '';
      this.setData({ id, _ownerId: id || uuid() });
      if (!id) return;
      const cinema = domain.getCinema(id);
      if (!cinema) {
        wx.showToast({ title: '影院不存在', icon: 'none' });
        return;
      }
      this.setData({
        name: cinema.name || '',
        note: cinema.note || '',
        images: cinema.images || []
      });
    }
  },
  methods: {
    onName(e) {
      this.setData({ name: e.detail.value });
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
        const row = domain.saveCinema({
          id: this.data.id || this.data._ownerId,
          name: this.data.name,
          note: this.data.note,
          images: this.data.images
        });
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(() => {
          if (this.data.cinemaId) routes.back();
          else routes.redirect(routes.cinemaDetail(row.id));
        }, 350);
      } catch (e) {
        wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' });
      }
    },
    onDelete() {
      if (!this.data.id) return;
      wx.showModal({
        title: '删除影院',
        content: '该影院下的厅记录会一起删掉。',
        success: (res) => {
          if (!res.confirm) return;
          try {
            domain.deleteCinema(this.data.id);
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
