const domain = require('../../domain/index');
const routes = require('../../config/routes');

Page({
  data: {
    id: '',
    order: null,
    scheduleText: '',
    statusLabel: '',
    status: '',
    items: [],
    materials: [],
    mains: [],
    seasonings: [],
    dishesWithout: [],
    canMarkCooking: false
  },

  onLoad(query) {
    this.setData({ id: query.id || '' });
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    let id = this.data.id;
    if (!id) {
      const snap = domain.cartSnapshot();
      id = snap.orderId || '';
      this.setData({ id });
    }
    const order = id ? domain.getOrder(id) : null;
    if (!order) {
      this.setData({
        order: null,
        items: [],
        materials: [],
        mains: [],
        seasonings: [],
        dishesWithout: [],
        canMarkCooking: false
      });
      return;
    }
    const mat = domain.collectOrderMaterials
      ? domain.collectOrderMaterials(order)
      : {
          materials: [],
          mains: [],
          seasonings: [],
          dishesWithout: [],
          text: ''
        };
    this._materialsText = mat.text || '';
    this.setData({
      order,
      scheduleText: order.scheduleText || '',
      statusLabel: order.statusLabel || '',
      status: order.status || '',
      items: order.items || [],
      materials: mat.materials || [],
      mains: mat.mains || [],
      seasonings: mat.seasonings || [],
      dishesWithout: mat.dishesWithout || [],
      canMarkCooking: order.status === 'preorder'
    });
  },

  onMarkCooking() {
    try {
      if (domain.cartMarkCooking) {
        domain.cartSwitchOrder && domain.cartSwitchOrder(this.data.id);
        domain.cartMarkCooking();
      } else {
        domain.setOrderStatus(this.data.id, 'cooking');
      }
      wx.showToast({ title: '制作中', icon: 'success' });
      this.refresh();
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
    }
  },

  onSettle() {
    const n = (this.data.items || []).length;
    if (!n) {
      wx.showToast({ title: '当前没有点餐', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认已就餐',
      content: `共 ${n} 道菜。确认后状态变为已就餐。`,
      confirmText: '已就餐',
      success: (res) => {
        if (!res.confirm) return;
        try {
          if (domain.cartSwitchOrder) {
            try {
              domain.cartSwitchOrder(this.data.id);
            } catch (e0) {
              // ignore
            }
          }
          const o = domain.cartSettle
            ? domain.cartSettle({ title: '已就餐' })
            : domain.setOrderStatus(this.data.id, 'dined');
          wx.showToast({ title: '已就餐', icon: 'success' });
          setTimeout(() => {
            if (o && o.id) routes.redirect(routes.orderDetail(o.id));
            else routes.back();
          }, 300);
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
        }
      }
    });
  },

  onCopyMaterials() {
    const text = this._materialsText || '';
    if (!text.trim()) {
      wx.showToast({ title: '暂无材料', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  }
});
