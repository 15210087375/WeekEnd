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
    orderId: '',
    mealDate: '',
    statusLabel: '',
    status: '',
    preorders: [],
    showPreorderBar: false,
    canShare: true,
    canCookActions: true
  },

  onShow() {
    let shouldOpenCart = false;
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.openCartOnShow) {
        shouldOpenCart = true;
        app.globalData.openCartOnShow = false;
      }
    } catch (e) {
      // ignore
    }

    // 半屏打开期间：禁止任何自动 setData（含 entries / 同步回调）
    if (this.data.cartOpen && !shouldOpenCart) {
      return;
    }

    if (shouldOpenCart) {
      this.openCart();
      return;
    }

    this.refreshHomeAndCart();

    if (this._homeShowSync) return;
    this._homeShowSync = true;
    domain
      .ensureSilentLogin()
      .then(() => {
        // 同步回来时若用户已打开半屏，丢弃 UI 更新
        if (this.data.cartOpen) return null;
        if (!(domain.syncCan && domain.syncCan())) return null;
        if (domain.cartIsShared && domain.cartIsShared() && domain.cartPull) {
          return domain.cartPull();
        }
        return domain.syncPull();
      })
      .then((snap) => {
        if (snap == null || this.data.cartOpen) return;
        this.refreshHomeAndCart(
          snap && snap.items != null ? snap : null
        );
      })
      .catch(() => {})
      .then(() => {
        this._homeShowSync = false;
      });
  },

  /** 首页入口 + 购物车数据（半屏关闭时）一次写齐 */
  refreshHomeAndCart(cartSnap) {
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
    const cartPatch = this.buildCartPatch(cartSnap || domain.cartSnapshot());
    const next = { entries, ...cartPatch };
    const sig = this._cartUiSignature({
      ...next,
      cartOpen: false
    });
    if (this._cartUiSig === sig && this._entriesSig === JSON.stringify(entries)) {
      return;
    }
    this._cartUiSig = sig;
    this._entriesSig = JSON.stringify(entries);
    this.setData(next);
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
    const es = JSON.stringify(entries);
    if (this._entriesSig === es) return;
    this._entriesSig = es;
    this.setData({ entries });
  },

  buildCartPatch(snap) {
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
  },

  /**
   * @param {object} [snap]
   * @param {object} [extra] cartOpen / force
   *   force: 用户操作（删菜/切单）允许在半屏打开时更新
   */
  applyCartSnapshot(snap, extra) {
    const ex = extra || {};
    const opening = ex.cartOpen === true;
    const closing = ex.cartOpen === false;
    // 半屏打开中：拦截后台快照，避免无数据变更也 setData 连闪
    if (this.data.cartOpen && !opening && !closing && !ex.force) {
      return;
    }
    const next = this.buildCartPatch(snap);
    Object.keys(ex).forEach((k) => {
      if (k === 'force') return;
      next[k] = ex[k];
    });
    const sig = this._cartUiSignature({
      ...next,
      cartOpen: next.cartOpen != null ? next.cartOpen : this.data.cartOpen
    });
    if (this._cartUiSig && this._cartUiSig === sig) return;
    this._cartUiSig = sig;
    this.setData(next);
  },

  _cartUiSignature(d) {
    try {
      return JSON.stringify({
        cartCount: d.cartCount,
        cartOpen: !!d.cartOpen,
        orderId: d.orderId,
        status: d.status,
        statusLabel: d.statusLabel,
        scheduleText: d.scheduleText,
        cartShared: d.cartShared,
        showPreorderBar: d.showPreorderBar,
        canShare: d.canShare,
        canCookActions: d.canCookActions,
        items: (d.cartItems || []).map((it) => it.dishId + ':' + it.name),
        preorders: (d.preorders || []).map(
          (p) => p.id + ':' + p.itemCount + ':' + (p.active ? 1 : 0)
        )
      });
    } catch (e) {
      return String(Date.now());
    }
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
    if (this.data.cartOpen) return;
    // 唯一允许的「打开」setData：本地快照 + cartOpen，无后续自动同步刷 UI
    this.applyCartSnapshot(domain.cartSnapshot(), { cartOpen: true });
  },

  closeCart() {
    if (!this.data.cartOpen) return;
    this.setData({ cartOpen: false });
    this._cartUiSig = null;
  },

  stopBubble() {},

  onSwitchPreorder(e) {
    const id = e.currentTarget.dataset.id;
    try {
      domain.cartSwitchOrder(id);
      this.applyCartSnapshot(domain.cartSnapshot(), { force: true });
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '切换失败', icon: 'none' });
    }
  },

  onNewPreorder() {
    this.setData({ cartOpen: false });
    routes.go(routes.orderSchedule({ mode: 'create' }));
  },

  /** 跳转二级页修改日期+餐次 */
  goEditSchedule() {
    const id = this.data.orderId;
    if (!id) {
      // 无订单时先走创建流程
      this.onNewPreorder();
      return;
    }
    this.setData({ cartOpen: false });
    routes.go(routes.orderSchedule({ id, mode: 'edit' }));
  },

  removeCartItem(e) {
    const id = e.currentTarget.dataset.id;
    Promise.resolve(domain.cartRemove(id)).then(() => {
      this.applyCartSnapshot(domain.cartSnapshot(), { force: true });
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
            this.applyCartSnapshot(domain.cartSnapshot(), { force: true });
            wx.showToast({ title: '已放弃', icon: 'none' });
          })
          .catch((e) => {
            wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
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
      this.setData({ cartOpen: false });
      setTimeout(() => routes.go(routes.orderDetail(o.id)), 300);
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
    }
  },

  /** 厨师台：制作中 / 已就餐 / 材料清单 */
  goChefDesk() {
    const id = this.data.orderId;
    if (!id) {
      wx.showToast({ title: '暂无订单', icon: 'none' });
      return;
    }
    this.setData({ cartOpen: false });
    routes.go(routes.orderChef(id));
  },

  goHistoryOrders() {
    this.setData({ cartOpen: false });
    routes.go(routes.orderList());
  }
});
