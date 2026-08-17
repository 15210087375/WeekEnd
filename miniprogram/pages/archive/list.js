const dishItem = require('../../presenters/dishItem');
const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { getModule, parseKind, isRecipe } = require('../../config/modules');
const { FOOD_CATEGORIES } = require('../../config/categories');

Page({
  data: {
    kind: '',
    isRecipe: false,
    addLabel: '',
    emptyText: '',
    theme: 'out',
    category: '',
    categories: FOOD_CATEGORIES,
    list: [],
    orderMode: false,
    selectedCount: 0,
    placing: false,
    /** 转场结束后再显示 fixed 底栏，避免底栏先于页面滑入 */
    fabVisible: false
  },

  onLoad(query) {
    const kind = parseKind(query.kind);
    const orderMode = query.order === '1' || query.order === 'true';
    const mod = getModule(kind);
    wx.setNavigationBarTitle({
      title: orderMode ? '点餐' : mod.name
    });
    // 首屏一次 setData：避免 onLoad 空列表 → onShow 再 refresh 的闪烁
    const built = this.buildListState({
      kind,
      orderMode,
      category: ''
    });
    this.setData({
      kind,
      isRecipe: isRecipe(kind),
      addLabel: mod.addLabel,
      emptyText: mod.emptyText,
      theme: mod.theme,
      categories: FOOD_CATEGORIES,
      orderMode,
      category: '',
      list: built.list,
      selectedCount: built.selectedCount,
      fabVisible: false
    });
    this._listBootstrapped = true;
  },

  onReady() {
    // 等 navigate 推入动画结束再挂 fixed 底栏（约 300ms）
    // 根因：fixed 不参与页面 transform，会「先贴在屏幕底再整页滑入」
    if (this._fabRevealTimer) clearTimeout(this._fabRevealTimer);
    this._fabRevealTimer = setTimeout(() => {
      this.setData({ fabVisible: true });
    }, 320);
  },

  onUnload() {
    if (this._fabRevealTimer) clearTimeout(this._fabRevealTimer);
  },

  onShow() {
    // 首次：数据已在 onLoad 就绪，不再整表 refresh
    if (this._listBootstrapped) {
      this._listBootstrapped = false;
      return;
    }
    // 从详情/编辑返回：点餐只同步勾选；浏览重载列表
    if (this.data.orderMode) {
      this.syncSelectionFromCart();
    } else {
      this.refresh();
    }
  },

  /**
   * @param {{ kind?: string, orderMode?: boolean, category?: string }} [ctx]
   */
  buildListState(ctx) {
    const kind = (ctx && ctx.kind) || this.data.kind;
    const orderMode =
      ctx && ctx.orderMode != null ? ctx.orderMode : this.data.orderMode;
    const category =
      ctx && ctx.category != null ? ctx.category : this.data.category;
    const filter = {};
    if (category) filter.category = category;
    const cartIds = orderMode ? new Set(domain.cartGetDishIds()) : null;
    let list;
    if (orderMode) {
      list = dishItem.search(filter);
    } else {
      list = dishItem.listByKind(kind, { filter });
    }
    list = list.map((it) => ({
      ...it,
      selected: cartIds ? cartIds.has(it.id) : false
    }));
    return {
      list,
      selectedCount: cartIds ? cartIds.size : 0
    };
  },

  refresh() {
    const built = this.buildListState();
    this.setData({
      list: built.list,
      selectedCount: built.selectedCount
    });
  },

  /** 仅更新勾选态，避免整表重建闪烁 */
  syncSelectionFromCart() {
    if (!this.data.orderMode) return;
    const cartIds = new Set(domain.cartGetDishIds());
    const list = this.data.list || [];
    const patch = {};
    let changed = false;
    for (let i = 0; i < list.length; i++) {
      const on = cartIds.has(list[i].id);
      if (!!list[i].selected !== on) {
        patch[`list[${i}].selected`] = on;
        changed = true;
      }
    }
    patch.selectedCount = cartIds.size;
    if (changed || this.data.selectedCount !== cartIds.size) {
      this.setData(patch);
    }
  },

  onCategory(e) {
    const category = e.currentTarget.dataset.id || '';
    if (category === this.data.category) return;
    this.setData({ category }, () => this.refresh());
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.orderMode) {
      if (!id) {
        wx.showToast({ title: '菜品无效', icon: 'none' });
        return;
      }
      // 仅本地勾选，不调云；路径更新 selected，不全表 refresh
      Promise.resolve(domain.cartToggle(id))
        .then(() => this.syncSelectionFromCart())
        .catch((err) => {
          wx.showToast({
            title: (err && err.message) || '操作失败',
            icon: 'none'
          });
          this.syncSelectionFromCart();
        });
      return;
    }
    routes.go(routes.dishDetail(id));
  },

  exitOrderMode() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    this.setData({ orderMode: false, selectedCount: 0 }, () => {
      wx.setNavigationBarTitle({
        title: getModule(this.data.kind).name
      });
      this.refresh();
    });
  },

  /**
   * 下单：写入当前预点餐订单并同步（家庭）
   */
  onPlaceOrder() {
    if (this.data.placing) return;
    const n = domain.cartCount ? domain.cartCount() : 0;
    if (!n) {
      wx.showToast({ title: '请先勾选菜品', icon: 'none' });
      return;
    }
    this.setData({ placing: true });
    // 保证有预点餐单
    try {
      if (domain.cartEnsurePreorder) domain.cartEnsurePreorder();
    } catch (e) {
      // ignore
    }
    const shared = domain.cartIsShared && domain.cartIsShared();
    Promise.resolve(
      domain.cartPlaceOrder ? domain.cartPlaceOrder() : Promise.resolve()
    )
      .then(() => {
        wx.showToast({
          title: shared ? '已下单，家人可见' : '已写入预点餐',
          icon: 'success'
        });
        // 返回首页后自动打开半屏购物车
        try {
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.openCartOnShow = true;
          }
        } catch (e) {
          // ignore
        }
        // 不在此页二次 refresh；立刻返回
        const pages = getCurrentPages();
        if (pages.length > 1) {
          wx.navigateBack();
        } else {
          this.setData({ placing: false });
          this.exitOrderMode();
        }
      })
      .catch((e) => {
        this.setData({ placing: false });
        wx.showToast({
          title: (e && e.message) || '下单失败',
          icon: 'none'
        });
      });
  },

  goEdit(e) {
    routes.go(
      routes.dishEdit({ id: e.currentTarget.dataset.id, kind: this.data.kind })
    );
  },

  goAdd() {
    routes.go(routes.dishEdit({ kind: this.data.kind }));
  },

  noop() {}
});
