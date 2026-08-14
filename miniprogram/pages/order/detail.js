const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { formatDateTime } = require('../../utils/format');

Page({
  data: {
    id: '',
    order: null,
    timeText: '',
    mealDate: '',
    mealSlotLabel: '',
    scheduleText: '',
    statusLabel: '',
    sharePath: ''
  },

  onLoad(query) {
    this.setData({ id: query.id || '' });
    // 右上角菜单也可分享
    if (wx.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage']
      });
    }
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const order = domain.getOrder(this.data.id);
    if (!order) {
      this.setData({ order: null });
      return;
    }
    const share = domain.encodeOrderShare(order);
    // 优先带完整快照，过长则降级 id（并依赖复制文字）
    let sharePath = `/pages/order/share?p=${share.encoded}`;
    if (share.tooLong) {
      sharePath = `/pages/order/share?id=${order.id}`;
    }
    this._shareText = domain.orderShareText(order);
    this._shareTooLong = share.tooLong;
    this.setData({
      order,
      timeText: formatDateTime(order.updatedAt || order.createdAt),
      mealDate: order.mealDate || '',
      mealSlotLabel: order.mealSlotLabel || '',
      scheduleText: order.scheduleText || '',
      statusLabel: order.statusLabel || '',
      sharePath
    });
  },

  goEditSchedule() {
    if (!this.data.id) return;
    routes.go(routes.orderSchedule({ id: this.data.id, mode: 'edit' }));
  },

  onShareAppMessage() {
    const order = this.data.order;
    const title = order
      ? `${order.title || '想吃清单'}（${order.items.length}道）`
      : '想吃清单';
    return {
      title: title.length > 22 ? title.slice(0, 22) : title,
      path: this.data.sharePath || '/pages/home/index'
    };
  },

  copyText() {
    const text = this._shareText || domain.orderShareText(this.data.order);
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showModal({
          title: '已复制',
          content: '清单文字已复制，可直接粘贴到微信发给家人。',
          showCancel: false
        });
      }
    });
  },

  onDelete() {
    wx.showModal({
      title: '删除清单',
      content: '确定删除这份想吃清单？',
      success: (res) => {
        if (!res.confirm) return;
        domain.deleteOrder(this.data.id);
        wx.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => routes.back(), 400);
      }
    });
  }
});
