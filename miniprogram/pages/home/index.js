/**
 * 美食首页：入口 + FAB 角标；半屏交给 components/cart-sheet
 */
const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { HOME_ENTRIES, getModule } = require('../../config/modules');

Page({
  data: {
    entries: [],
    cartCount: 0
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

    const sheet = this.getCartSheet();
    if (sheet && sheet.isOpen && sheet.isOpen() && !shouldOpenCart) {
      // 半屏打开中：不刷首页、不同步写 UI（组件独占）
      return;
    }

    this.refreshEntries();
    this.refreshCartCount();

    if (shouldOpenCart) {
      this.openCart();
      return;
    }

    if (this._homeShowSync) return;
    this._homeShowSync = true;
    domain
      .ensureSilentLogin()
      .then(() => {
        if (this.getCartSheet() && this.getCartSheet().isOpen()) return null;
        if (!(domain.syncCan && domain.syncCan())) return null;
        // 单入口
        if (domain.syncRefresh) return domain.syncRefresh();
        if (domain.cartIsShared && domain.cartIsShared() && domain.cartPull) {
          return domain.cartPull();
        }
        return domain.syncPull();
      })
      .then((snap) => {
        if (snap == null) return;
        if (this.getCartSheet() && this.getCartSheet().isOpen()) return;
        this.refreshEntries();
        this.refreshCartCount();
      })
      .catch(() => {})
      .then(() => {
        this._homeShowSync = false;
      });
  },

  getCartSheet() {
    return this.selectComponent('#cartSheet');
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

  refreshCartCount() {
    const n = domain.cartCount ? domain.cartCount() : 0;
    if (n !== this.data.cartCount) {
      this.setData({ cartCount: n });
    }
  },

  onCartCount(e) {
    const n = (e.detail && e.detail.count) || 0;
    if (n !== this.data.cartCount) {
      this.setData({ cartCount: n });
    }
  },

  onEntryTap(e) {
    routes.go(routes.archiveList(e.currentTarget.dataset.kind));
  },

  openCart() {
    const sheet = this.getCartSheet();
    if (sheet && sheet.open) sheet.open();
  }
});
