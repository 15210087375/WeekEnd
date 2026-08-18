const domain = require('../../domain/index');
const routes = require('../../config/routes');

Page({
  data: {
    spaceTitle: '仅本机',
    spaceSubtitle: '数据仅保存在本机',
    spaceTagText: '仅本机',
    spaceTagType: 'local',
    canSync: false
  },

  onShow() {
    this.refreshSpaceStatus();
    domain.ensureSilentLogin().then(() => {
      this.refreshSpaceStatus();
    });
  },

  refreshSpaceStatus() {
    const s = domain.spaceStatusSummary();
    this.setData({
      spaceTitle: s.title,
      spaceSubtitle: s.subtitle,
      spaceTagText: s.tagText,
      spaceTagType: s.tagType,
      canSync: !!(domain.syncCan && domain.syncCan())
    });
  },

  onSyncFamily() {
    if (!domain.syncCan || !domain.syncCan()) {
      wx.showToast({ title: '请先加入家庭空间', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '同步中…', mask: true });
    domain
      .syncFull({ uploadLocal: true })
      .then((r) => {
        wx.hideLoading();
        if (r && r.ok) {
          wx.showToast({ title: '同步完成', icon: 'success' });
        } else {
          wx.showToast({
            title: (r && r.download && r.download.error) || '同步失败',
            icon: 'none'
          });
        }
        this.refreshSpaceStatus();
      })
      .catch((e) => {
        wx.hideLoading();
        wx.showToast({ title: (e && e.message) || '同步失败', icon: 'none' });
      });
  },

  goOrders() {
    routes.go(routes.orderList());
  },

  goHistory() {
    routes.go(routes.historyList());
  },

  goRegion() {
    routes.go(routes.regionEdit());
  },

  goBackup() {
    routes.go(routes.backup());
  },

  goSpace() {
    routes.go(routes.space());
  },

  onLoadTestDishes() {
    wx.showModal({
      title: '加载测试家常菜',
      content: '将写入 10 道家常菜到「我的菜谱」。同名已存在则静默跳过、不改名。是否继续？',
      success: (res) => {
        if (!res.confirm) return;
        try {
          const result = domain.seedTestHomemade();
          wx.showModal({
            title: '完成',
            content: `新增 ${result.added} 道，跳过 ${result.skipped} 道（已存在）。\n可到美食 → 我的菜谱查看。`,
            showCancel: false
          });
        } catch (e) {
          wx.showToast({
            title: (e && e.message) || '加载失败',
            icon: 'none'
          });
        }
      }
    });
  }
});
