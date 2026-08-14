const repo = require('../../services/repository');

Page({
  data: {
    id: '',
    name: '',
    regions: [],
    regionNames: [],
    regionIndex: 0
  },

  onLoad(query) {
    this._presetRegionId = query.regionId || '';
    this.setData({ id: query.id || '' });
  },

  onShow() {
    const regions = repo.listRegions();
    const regionNames = regions.map((r) => r.name);
    let regionIndex = 0;
    let name = this.data.name;

    if (this.data.id) {
      const mall = repo.getMall(this.data.id);
      if (mall) {
        name = mall.name;
        const ri = regions.findIndex((r) => r.id === mall.regionId);
        if (ri >= 0) regionIndex = ri;
      }
    } else if (this._presetRegionId) {
      const ri = regions.findIndex((r) => r.id === this._presetRegionId);
      if (ri >= 0) regionIndex = ri;
    }

    this.setData({ regions, regionNames, regionIndex, name });
  },

  onName(e) {
    this.setData({ name: e.detail.value });
  },

  onRegionPick(e) {
    this.setData({ regionIndex: Number(e.detail.value) });
  },

  onSave() {
    try {
      const { regions, regionIndex } = this.data;
      if (!regions.length) {
        wx.showToast({ title: '请先创建区域', icon: 'none' });
        return;
      }
      repo.saveMall({
        id: this.data.id || undefined,
        regionId: regions[regionIndex].id,
        name: this.data.name
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 400);
    } catch (e) {
      wx.showToast({ title: e.message || '失败', icon: 'none' });
    }
  },

  onDelete() {
    wx.showModal({
      title: '删除商场',
      content: '有子门店时无法删除',
      success: (res) => {
        if (!res.confirm) return;
        try {
          repo.deleteMall(this.data.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 400);
        } catch (e) {
          wx.showToast({ title: e.message || '失败', icon: 'none' });
        }
      }
    });
  }
});
