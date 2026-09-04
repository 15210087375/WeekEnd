const repo = require('../../services/repository');
const fabReveal = require('../../behaviors/fabReveal');

function emptyBranch() {
  return {
    id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    address: '',
    navUrl: '',
    note: ''
  };
}

Page({
  behaviors: [fabReveal],
  data: {
    id: '',
    brandName: '',
    address: '',
    navUrl: '',
    note: '',
    isVirtual: false,
    branches: [],
    regions: [],
    regionNames: [],
    regionIndex: 0,
    malls: [],
    mallNames: ['无 / 街边店'],
    mallIndex: 0
  },

  onLoad(query) {
    this._presetRegionId = query.regionId || '';
    this._presetMallId = query.mallId || '';
    this.setData({ id: query.id || '' });
  },

  onShow() {
    this.loadForm();
  },

  loadForm() {
    const regions = repo.listRegions();
    const regionNames = regions.map((r) => r.name);
    let regionIndex = 0;
    let brandName = this.data.brandName;
    let address = this.data.address;
    let navUrl = this.data.navUrl;
    let note = this.data.note;
    let isVirtual = this.data.isVirtual;
    let mallId = this._presetMallId || null;
    let branches = this.data.branches || [];

    if (this.data.id) {
      const place = repo.getPlace(this.data.id);
      if (place) {
        brandName = place.brandName;
        address = place.address || '';
        navUrl = place.navUrl || '';
        note = place.note || '';
        isVirtual = !!place.isVirtual;
        mallId = place.mallId;
        branches = (place.branches || []).map((b) => ({
          id: b.id,
          name: b.name || '',
          address: b.address || '',
          navUrl: b.navUrl || '',
          note: b.note || ''
        }));
        const ri = regions.findIndex((r) => r.id === place.regionId);
        if (ri >= 0) regionIndex = ri;
      }
    } else if (this._presetRegionId) {
      const ri = regions.findIndex((r) => r.id === this._presetRegionId);
      if (ri >= 0) regionIndex = ri;
    }

    const regionId = regions[regionIndex] ? regions[regionIndex].id : '';
    const malls = regionId ? repo.listMalls(regionId) : [];
    const mallNames = ['无 / 街边店'].concat(malls.map((m) => m.name));
    let mallIndex = 0;
    if (mallId) {
      const mi = malls.findIndex((m) => m.id === mallId);
      if (mi >= 0) mallIndex = mi + 1;
    }

    this.setData({
      regions,
      regionNames,
      regionIndex,
      malls,
      mallNames,
      mallIndex,
      brandName,
      address,
      navUrl,
      note,
      isVirtual,
      branches
    });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onBranchInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const field = e.currentTarget.dataset.field;
    const branches = (this.data.branches || []).slice();
    if (!branches[index]) return;
    branches[index] = { ...branches[index], [field]: e.detail.value };
    this.setData({ branches });
  },

  onAddBranch() {
    this.setData({
      branches: (this.data.branches || []).concat([emptyBranch()])
    });
  },

  onRemoveBranch(e) {
    const index = Number(e.currentTarget.dataset.index);
    const branches = (this.data.branches || []).slice();
    branches.splice(index, 1);
    this.setData({ branches });
  },

  onRegionPick(e) {
    const regionIndex = Number(e.detail.value);
    const region = this.data.regions[regionIndex];
    const malls = region ? repo.listMalls(region.id) : [];
    this.setData({
      regionIndex,
      malls,
      mallNames: ['无 / 街边店'].concat(malls.map((m) => m.name)),
      mallIndex: 0
    });
  },

  onMallPick(e) {
    this.setData({ mallIndex: Number(e.detail.value) });
  },

  toggleVirtual() {
    this.setData({ isVirtual: !this.data.isVirtual });
  },

  goAddRegion() {
    wx.navigateTo({ url: '/pages/region/edit' });
  },

  onSave() {
    try {
      const { regions, regionIndex, malls, mallIndex } = this.data;
      if (!regions.length) {
        wx.showToast({ title: '请先创建区域', icon: 'none' });
        return;
      }
      const regionId = regions[regionIndex].id;
      const mallId = mallIndex === 0 ? null : malls[mallIndex - 1].id;
      const row = repo.savePlace({
        id: this.data.id || undefined,
        regionId,
        mallId,
        brandName: this.data.brandName,
        address: this.data.address,
        navUrl: this.data.navUrl,
        note: this.data.note,
        isVirtual: this.data.isVirtual,
        branches: this.data.branches
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/place/detail?id=${row.id}` });
      }, 400);
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  onDelete() {
    wx.showModal({
      title: '删除门店',
      content: '有子菜品时无法删除。确定删除？',
      success: (res) => {
        if (!res.confirm) return;
        try {
          repo.deletePlace(this.data.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 400);
        } catch (e) {
          wx.showToast({ title: e.message || '删除失败', icon: 'none' });
        }
      }
    });
  }
});
