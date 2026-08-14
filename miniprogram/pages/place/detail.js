const repo = require('../../services/repository');
const { KIND_LABELS } = require('../../utils/constants');

Page({
  data: {
    id: '',
    place: null,
    regionName: '',
    mallName: '',
    dishes: []
  },

  onLoad(query) {
    this.setData({ id: query.id || '' });
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const place = repo.getPlace(this.data.id);
    if (!place) {
      wx.showToast({ title: '门店不存在', icon: 'none' });
      return;
    }
    const region = repo.getRegion(place.regionId);
    const mall = place.mallId ? repo.getMall(place.mallId) : null;
    const dishes = repo.listDishes({ placeId: place.id }).map((d) => ({
      ...d,
      kindLabel: KIND_LABELS[d.kind] || d.kind
    }));
    this.setData({
      place,
      regionName: region ? region.name : '',
      mallName: mall ? mall.name : '',
      dishes
    });
    wx.setNavigationBarTitle({ title: place.brandName || '门店' });
  },

  goDish(e) {
    wx.navigateTo({ url: `/pages/dish/detail?id=${e.currentTarget.dataset.id}` });
  },

  onEdit() {
    wx.navigateTo({ url: `/pages/place/edit?id=${this.data.id}` });
  },

  onAddDish() {
    wx.navigateTo({ url: `/pages/dish/edit?placeId=${this.data.id}&kind=dine_out` });
  },

  openNav() {
    const url = this.data.place && this.data.place.navUrl;
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
    });
  }
});
