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
    // 先本地一帧，避免空白
    this.refreshEntries();
    this.applyCartSnapshot(domain.cartSnapshot());

    // 选菜下单返回：自动打开半屏
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
    if (shouldOpenCart) {
      // 等返回动画结束再开半屏，避免与页面切换抢渲染
      setTimeout(() => {
        if (typeof this.openCart === 'function') this.openCart();
      }, 50);
    }

    // 合并同步：只 pull 一次 + 只 setData 一次，避免下单返回后连闪
    if (this._homeShowSync) return;
    this._homeShowSync = true;
    domain
      .ensureSilentLogin()
      .then(() => {
        if (!(domain.syncCan && domain.syncCan())) return null;
        // cart.pull 内部也是 order 同步；有家庭时只走 cartPull 即可
        if (domain.cartIsShared && domain.cartIsShared() && domain.cartPull) {
          return domain.cartPull();
        }
        return domain.syncPull();
      })
      .then((snap) => {
        if (snap == null) return;
        this.refreshEntries();
        this.applyCartSnapshot(
          snap && snap.items != null ? snap : domain.cartSnapshot()
        );
      })
      .catch(() => {})
      .then(() => {
        this._homeShowSync = false;
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

  /**
   * @param {object} [snap]
   * @param {object} [extra] 合并进同一次 setData（如 cartOpen）
   */
  applyCartSnapshot(snap, extra) {
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
    const next = {
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
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach((k) => {
        next[k] = extra[k];
      });
    }
    // 签名含开关状态；无业务变化则跳过 setData，避免顶部狂闪
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

  /** 静默拉购物车（打开半屏时家庭模式用，无 UI 刷新手势） */
  syncCart(silent) {
    if (this._cartSyncing) {
      return this._cartSyncing;
    }
    if (!domain.cartPull) {
      this.applyCartSnapshot(domain.cartSnapshot());
      return Promise.resolve();
    }
    this._cartSyncing = domain
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
      .then(() => {
        this._cartSyncing = null;
      });
    return this._cartSyncing;
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
    // 一次 setData：快照 + 打开
    this.applyCartSnapshot(domain.cartSnapshot(), {
      cartOpen: true
    });
    // 家庭静默同步；结果无变化则不再 setData
    if (domain.cartIsShared && domain.cartIsShared()) {
      this.syncCart(true);
    }
  },

  closeCart() {
    this.setData({ cartOpen: false });
    this._cartUiSig = null;
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
