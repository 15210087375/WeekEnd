const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { HOME_ENTRIES, getModule } = require('../../config/modules');
const { DISH_KIND } = require('../../utils/constants');

Page({
  data: {
    entries: [],
    cartCount: 0,
    cartOpen: false,
    cartItems: [],
    cartShared: false,
    cartSyncing: false,
    orderId: '',
    mealDate: '',
    statusLabel: '',
    status: '',
    preorders: [],
    canShare: true
  },

  onShow() {
    this.refreshEntries();
    this.applyCartSnapshot(domain.cartSnapshot());
    domain.ensureSilentLogin().then(() => {
      if (domain.syncCan && domain.syncCan()) {
        domain.syncPull().then(() => {
          this.refreshEntries();
          this.applyCartSnapshot(domain.cartSnapshot());
        });
      }
      if (domain.cartIsShared && domain.cartIsShared()) {
        this.syncCart(true);
      }
    });
  },

  refreshEntries() {
    const stats = domain.getStats();
    const countMap = {
      dine_out: stats.dineOutCount,
      homemade: stats.homemadeCount
    };
    const entries = HOME_ENTRIES.map((kind) => {
      const mod = getModule(kind);
      return {
        kind: mod.kind,
        name: mod.name,
        desc: mod.desc,
        theme: mod.theme,
        count: countMap[kind] || 0
      };
    });
    this.setData({ entries });
  },

  applyCartSnapshot(snap) {
    const s = snap || domain.cartSnapshot();
    const preorders = (s.preorders || []).map((o) => ({
      id: o.id,
      mealDate: o.mealDate,
      itemCount: o.itemCount || (o.items && o.items.length) || 0,
      statusLabel: o.statusLabel,
      active: o.id === s.orderId
    }));
    this.setData({
      cartCount: s.count || 0,
      cartItems: s.items || [],
      cartShared: !!s.shared,
      orderId: s.orderId || '',
      mealDate: s.mealDate || domain.orderToday(),
      status: s.status || '',
      statusLabel: s.statusLabel || '',
      preorders,
      canShare: !s.shared
    });
  },

  syncCart(silent) {
    if (!domain.cartPull) {
      this.applyCartSnapshot(domain.cartSnapshot());
      return Promise.resolve();
    }
    if (!silent) this.setData({ cartSyncing: true });
    return domain
      .cartPull()
      .then((snap) => {
        this.applyCartSnapshot(snap);
        if (!silent && snap && !snap.syncError) {
          wx.showToast({ title: '已同步', icon: 'success' });
        }
      })
      .catch((e) => {
        if (!silent) {
          wx.showToast({
            title: (e && e.message) || '同步失败',
            icon: 'none'
          });
        }
      })
      .then(() => this.setData({ cartSyncing: false }));
  },

  onEntryTap(e) {
    routes.go(routes.archiveList(e.currentTarget.dataset.kind));
  },

  goOrder() {
    // 确保有预点餐再去选菜
    try {
      domain.cartEnsurePreorder(this.data.mealDate || domain.orderToday());
    } catch (e) {
      // ignore
    }
    this.setData({ cartOpen: false });
    routes.go(routes.archiveList(DISH_KIND.DINE_OUT, { order: '1' }));
  },

  openCart() {
    this.applyCartSnapshot(domain.cartSnapshot());
    this.setData({ cartOpen: true });
    if (domain.cartIsShared && domain.cartIsShared()) {
      this.syncCart(true);
    }
  },

  closeCart() {
    this.setData({ cartOpen: false });
  },

  onRefreshCart() {
    this.syncCart(false);
  },

  stopBubble() {},

  onSwitchPreorder(e) {
    const id = e.currentTarget.dataset.id;
    try {
      domain.cartSwitchOrder(id);
      this.applyCartSnapshot(domain.cartSnapshot());
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '切换失败', icon: 'none' });
    }
  },

  onNewPreorder() {
    try {
      domain.cartCreatePreorder(this.data.mealDate || domain.orderToday());
      this.applyCartSnapshot(domain.cartSnapshot());
      wx.showToast({ title: '已新建预点餐', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '创建失败', icon: 'none' });
    }
  },

  onMealDateChange(e) {
    const mealDate = e.detail.value;
    try {
      domain.cartSetMealDate(mealDate);
      this.applyCartSnapshot(domain.cartSnapshot());
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '日期无效', icon: 'none' });
    }
  },

  removeCartItem(e) {
    const id = e.currentTarget.dataset.id;
    Promise.resolve(domain.cartRemove(id)).then(() => {
      this.applyCartSnapshot(domain.cartSnapshot());
    });
  },

  abandonCart() {
    if (!this.data.orderId && !this.data.cartCount) return;
    wx.showModal({
      title: '放弃本单',
      content: '将取消当前预点餐，不作为已就餐记录。确定？',
      confirmColor: '#fa5151',
      confirmText: '放弃',
      success: (res) => {
        if (!res.confirm) return;
        Promise.resolve(domain.cartAbandon())
          .then(() => {
            this.applyCartSnapshot(domain.cartSnapshot());
            wx.showToast({ title: '已放弃', icon: 'none' });
          })
          .catch((e) => {
            wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
          });
      }
    });
  },

  markCooking() {
    try {
      domain.cartMarkCooking();
      this.applyCartSnapshot(domain.cartSnapshot());
      wx.showToast({ title: '制作中', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
    }
  },

  shareCart() {
    if (!this.data.cartCount) {
      wx.showToast({ title: '当前没有点餐', icon: 'none' });
      return;
    }
    try {
      const o = domain.cartCreateShareOrder({ title: '想吃清单' });
      this.setData({ cartOpen: false });
      setTimeout(() => routes.go(routes.orderDetail(o.id)), 300);
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
    }
  },

  settleCart() {
    if (!this.data.cartCount) {
      wx.showToast({ title: '当前没有点餐', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认已就餐',
      content: `共 ${this.data.cartCount} 道菜（${this.data.mealDate || ''}）。确认后状态变为已就餐。`,
      confirmText: '已就餐',
      success: (res) => {
        if (!res.confirm) return;
        try {
          const o = domain.cartSettle({ title: '已就餐' });
          this.applyCartSnapshot(domain.cartSnapshot());
          this.setData({ cartOpen: false });
          wx.showToast({ title: '已就餐', icon: 'success' });
          setTimeout(() => routes.go(routes.orderDetail(o.id)), 300);
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
        }
      }
    });
  },

  goHistoryOrders() {
    this.setData({ cartOpen: false });
    routes.go(routes.orderList());
  }
});
