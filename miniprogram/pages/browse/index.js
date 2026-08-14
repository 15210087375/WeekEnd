/**
 * 兼容旧入口：原「浏览」Tab 已并入「搜索 → 目录」
 */
Page({
  onShow() {
    wx.switchTab({ url: '/pages/search/index' });
  }
});
