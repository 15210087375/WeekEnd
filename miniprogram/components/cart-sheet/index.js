/**
 * 当前点餐半屏：独占购物车 UI 与 setData
 * 首页只负责 open/close 与角标 countchange
 */
const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { DISH_KIND } = require('../../utils/constants');

function buildPatch(snap) {
  const s = snap || domain.cartSnapshot();
  const preorders = (s.preorders || []).map((o) => ({
    id: o.id,
    mealDate: o.mealDate,
    mealSlotLabel: o.mealSlotLabel || '',
    scheduleText: o.scheduleText || o.mealDate,
    itemCount: o.itemCount || (o.items && o.items.length) || 0,
    statusLabel: o.statusLabel,
    active: o.id === s.orderId
  }));
  const shared = !!s.shared;
  let isCook = true;
  try {
    isCook = domain.isCook ? domain.isCook() : !shared;
  } catch (e) {
    isCook = !shared;
  }
  return {
    cartCount: s.count || 0,
    cartItems: s.items || [],
    cartShared: shared,
    orderId: s.orderId || '',
    mealDate: s.mealDate || domain.orderToday(),
    mealSlot: s.mealSlot || 'lunch',
    mealSlotLabel: s.mealSlotLabel || '',
    scheduleText: s.scheduleText || '',
    status: s.status || '',
    statusLabel: s.statusLabel || '',
    preorders,
    showPreorderBar: preorders.length >= 2,
    canShare: !shared,
    canCookActions: !shared || isCook
  };
}

Component({
  data: {
    open: false,
    cartCount: 0,
    cartItems: [],
    cartShared: false,
    orderId: '',
    mealDate: '',
    mealSlot: 'lunch',
    mealSlotLabel: '',
    scheduleText: '',
    status: '',
    statusLabel: '',
    preorders: [],
    showPreorderBar: false,
    canShare: true,
    canCookActions: true
  },

  methods: {
    noop() {},

    /** @returns {boolean} */
    isOpen() {
      return !!this.data.open;
    },

    /** 打开半屏：一次 setData 载入快照 */
    open() {
      if (this.data.open) return;
      const patch = buildPatch(domain.cartSnapshot());
      this.setData(Object.assign({ open: true }, patch));
      this.triggerEvent('countchange', { count: patch.cartCount });
      this.triggerEvent('openchange', { open: true });
    },

    close() {
      if (!this.data.open) return;
      this.setData({ open: false });
      this.triggerEvent('openchange', { open: false });
      this.triggerEvent('countchange', {
        count: domain.cartCount ? domain.cartCount() : this.data.cartCount
      });
    },

    /** 用户操作后刷新半屏内容 */
    renderFromDomain() {
      const patch = buildPatch(domain.cartSnapshot());
      this.setData(patch);
      this.triggerEvent('countchange', { count: patch.cartCount });
    },

    /** 仅角标（半屏关闭时供页面同步后调用） */
    syncCountOnly() {
      const n = domain.cartCount ? domain.cartCount() : 0;
      if (n !== this.data.cartCount) {
        this.setData({ cartCount: n });
      }
      this.triggerEvent('countchange', { count: n });
    },

    onSwitchPreorder(e) {
      const id = e.currentTarget.dataset.id;
      try {
        domain.cartSwitchOrder(id);
        this.renderFromDomain();
      } catch (err) {
        wx.showToast({ title: (err && err.message) || '切换失败', icon: 'none' });
      }
    },

    onNewPreorder() {
      this.close();
      routes.go(routes.orderSchedule({ mode: 'create' }));
    },

    goEditSchedule() {
      const id = this.data.orderId;
      if (!id) {
        this.onNewPreorder();
        return;
      }
      this.close();
      routes.go(routes.orderSchedule({ id, mode: 'edit' }));
    },

    goOrder() {
      try {
        domain.cartEnsurePreorder(this.data.mealDate || domain.orderToday());
      } catch (e) {
        // ignore
      }
      // 先跳转再关半屏：避免「半屏底栏先闪没 → 新页 fixed 底栏再进」叠成两次底栏动画
      routes.go(routes.archiveList(DISH_KIND.DINE_OUT, { order: '1' }));
      setTimeout(() => this.close(), 320);
    },

    removeCartItem(e) {
      const id = e.currentTarget.dataset.id;
      Promise.resolve(domain.cartRemove(id)).then(() => {
        this.renderFromDomain();
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
              this.renderFromDomain();
              wx.showToast({ title: '已放弃', icon: 'none' });
            })
            .catch((err) => {
              wx.showToast({
                title: (err && err.message) || '失败',
                icon: 'none'
              });
            });
        }
      });
    },

    shareCart() {
      if (!this.data.cartCount) {
        wx.showToast({ title: '当前没有点餐', icon: 'none' });
        return;
      }
      try {
        const o = domain.cartCreateShareOrder({ title: '想吃清单' });
        this.close();
        setTimeout(() => routes.go(routes.orderDetail(o.id)), 300);
      } catch (err) {
        wx.showToast({ title: (err && err.message) || '失败', icon: 'none' });
      }
    },

    goChefDesk() {
      const id = this.data.orderId;
      if (!id) {
        wx.showToast({ title: '暂无订单', icon: 'none' });
        return;
      }
      this.close();
      routes.go(routes.orderChef(id));
    },

    goHistoryOrders() {
      this.close();
      routes.go(routes.orderList());
    }
  }
});
