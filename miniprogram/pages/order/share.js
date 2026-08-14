const domain = require('../../domain/index');

Page({
  data: {
    ready: false,
    title: '',
    note: '',
    items: []
  },

  onLoad(query) {
    // 优先 path 内嵌快照（家人跨设备可见）
    if (query.p) {
      const parsed = domain.parseOrderShare(query.p);
      if (parsed) {
        this.setData({
          ready: true,
          title: parsed.title,
          note: parsed.note,
          items: parsed.items
        });
        wx.setNavigationBarTitle({ title: parsed.title || '想吃清单' });
        return;
      }
    }
    // 降级：本机订单 id
    if (query.id) {
      const order = domain.getOrder(query.id);
      if (order) {
        this.setData({
          ready: true,
          title: order.title,
          note: order.note,
          items: (order.items || []).map((it) => ({
            name: it.name,
            categoryLabel: it.categoryLabel,
            placeLabel: it.placeLabel
          }))
        });
        wx.setNavigationBarTitle({ title: order.title || '想吃清单' });
        return;
      }
    }
    this.setData({ ready: true, title: '想吃清单', items: [] });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' });
  }
});
