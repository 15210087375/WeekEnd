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
    placing: false
  },

  onLoad(query) {
    const kind = parseKind(query.kind);
    const orderMode = query.order === '1' || query.order === 'true';
    const mod = getModule(kind);
    this.setData({
      kind,
      isRecipe: isRecipe(kind),
      addLabel: mod.addLabel,
      emptyText: mod.emptyText,
      theme: mod.theme,
      categories: FOOD_CATEGORIES,
      orderMode
    });
    wx.setNavigationBarTitle({
      title: orderMode ? '点餐 · 勾选加入' : mod.name
    });
  },

  onShow() {
    if (this.data.orderMode && domain.cartIsShared && domain.cartIsShared()) {
      Promise.resolve(domain.cartPull())
        .catch(() => null)
        .then(() => this.refresh());
    } else {
      this.refresh();
    }
  },

  refresh() {
    const filter = {};
    if (this.data.category) filter.category = this.data.category;
    // 点餐模式：勾选与「当前点餐」购物车同步
    const cartIds = this.data.orderMode
      ? new Set(domain.cartGetDishIds())
      : null;
    let list;
    if (this.data.orderMode) {
      list = dishItem.search(filter);
    } else {
      list = dishItem.listByKind(this.data.kind, { filter });
    }
    list = list.map((it) => ({
      ...it,
      selected: cartIds ? cartIds.has(it.id) : false
    }));
    this.setData({
      list,
      selectedCount: cartIds ? cartIds.size : 0
    });
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
      // 仅本地勾选，不调云
      Promise.resolve(domain.cartToggle(id))
        .then(() => this.refresh())
        .catch((err) => {
          wx.showToast({
            title: (err && err.message) || '操作失败',
            icon: 'none'
          });
          this.refresh();
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
        this.setData({ placing: false });
        wx.showToast({
          title: shared ? '已下单，家人可见' : '已写入预点餐',
          icon: 'success'
        });
        setTimeout(() => {
          const pages = getCurrentPages();
          if (pages.length > 1) wx.navigateBack();
          else this.exitOrderMode();
        }, 400);
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
