const dishItem = require('../../presenters/dishItem');
const domain = require('../../domain/index');
const routes = require('../../config/routes');
const fabReveal = require('../../behaviors/fabReveal');
const { getModule, parseKind, isRecipe } = require('../../config/modules');
const { FOOD_CATEGORIES, normalizeCategory } = require('../../config/categories');
const { DISH_KIND, VIRTUAL_HOME_BRAND } = require('../../utils/constants');

function isSeedPlace(p) {
  if (!p) return true;
  const fallback = getModule(DISH_KIND.DINE_OUT).defaultPlaceBrand;
  if (p.brandName === fallback) return true;
  if (p.isVirtual && p.brandName === VIRTUAL_HOME_BRAND) return true;
  return false;
}

function hay(s) {
  return String(s || '').toLowerCase();
}

function placeSubLine(p) {
  if (!p) return '';
  const region = domain.getRegion(p.regionId);
  const mall = p.mallId ? domain.getMall(p.mallId) : null;
  const parts = [];
  if (region && region.name) parts.push(region.name);
  if (mall && mall.name) parts.push(mall.name);
  if (p.address) parts.push(p.address);
  return parts.join(' · ');
}

function dishTextHit(d, k) {
  if (!k) return true;
  if (d.name && hay(d.name).indexOf(k) >= 0) return true;
  if (d.note && hay(d.note).indexOf(k) >= 0) return true;
  return (d.tasteTags || []).some((t) => hay(t).indexOf(k) >= 0);
}

function brandKeyOf(p) {
  const b = String((p && p.brandName) || '').trim();
  return b ? hay(b) : `id:${p && p.id}`;
}

function branchLabel(p) {
  if (!p) return '分店';
  if (p.storeName) return p.storeName;
  const sub = placeSubLine(p);
  return sub || '分店';
}

function toPlaceRow(p, rows, cartIds) {
  const picked = cartIds ? rows.filter((d) => cartIds.has(d.id)).length : 0;
  return {
    id: p.id,
    placeId: p.id,
    placeIds: [p.id],
    brandKey: brandKeyOf(p),
    branchCount: 1,
    name: domain.placeLabel(p),
    subLine: placeSubLine(p),
    note: p.note || '',
    dishCount: rows.length,
    picked
  };
}

Page({
  behaviors: [fabReveal],
  data: {
    kind: '',
    isRecipe: false,
    addLabel: '',
    emptyText: '',
    theme: 'out',
    category: '',
    categories: FOOD_CATEGORIES,
    list: [],
    places: [],
    dishHits: [],
    keyword: '',
    placeFirst: false,
    view: 'places',
    placeId: '',
    placeTitle: '',
    placeInfo: null,
    brandKey: '',
    brandTitle: '',
    orderMode: false,
    selectedCount: 0,
    placing: false,
    showCustom: false,
    customName: '',
    customNote: ''
  },

  onLoad(query) {
    const kind = parseKind(query.kind);
    const orderMode = query.order === '1' || query.order === 'true';
    const mod = getModule(kind);
    wx.setNavigationBarTitle({
      title: orderMode ? '点餐' : mod.name
    });
    // 首屏一次 setData：避免 onLoad 空列表 → onShow 再 refresh 的闪烁
    const recipe = isRecipe(kind);
    const built = this.buildListState({
      kind,
      orderMode,
      category: '',
      keyword: '',
      view: 'places',
      placeId: ''
    });
    this.setData({
      kind,
      isRecipe: recipe,
      placeFirst: !recipe,
      view: 'places',
      placeId: '',
      placeTitle: '',
      keyword: '',
      addLabel: mod.addLabel,
      emptyText: built.emptyText || mod.emptyText,
      theme: mod.theme,
      categories: FOOD_CATEGORIES,
      orderMode,
      category: '',
      list: built.list,
      places: built.places,
      dishHits: built.dishHits,
      selectedCount: built.selectedCount
    });
    this._listBootstrapped = true;
    this._fromSchedule = !!(query && query.from === 'schedule');
    this._scheduleDate = query && query.date ? String(query.date).slice(0, 10) : '';
    if (orderMode && query.date && domain.cartEnsurePreorder) {
      try {
        domain.cartEnsurePreorder(String(query.date).slice(0, 10));
      } catch (e) {
        // ignore
      }
    }
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
   * @param {{ kind?: string, orderMode?: boolean, category?: string, keyword?: string, view?: string, placeId?: string }} [ctx]
   */
  buildListState(ctx) {
    const kind = (ctx && ctx.kind) || this.data.kind;
    const orderMode =
      ctx && ctx.orderMode != null ? ctx.orderMode : this.data.orderMode;
    const category =
      ctx && ctx.category != null ? ctx.category : this.data.category;
    const keyword =
      ctx && ctx.keyword != null ? ctx.keyword : this.data.keyword;
    const view = (ctx && ctx.view) || this.data.view || 'places';
    const placeId =
      ctx && ctx.placeId != null ? ctx.placeId : this.data.placeId;
    const cartIds = orderMode ? new Set(domain.cartGetDishIds()) : null;
    const mark = (rows) =>
      (rows || []).map((it) => ({
        ...it,
        selected: cartIds ? cartIds.has(it.id) : false
      }));

    if (isRecipe(kind)) {
      const filter = {};
      if (category) filter.category = category;
      if (keyword) filter.keyword = keyword;
      let list;
      if (orderMode) list = dishItem.search(filter);
      else list = dishItem.listByKind(kind, { filter });
      return {
        list: mark(list),
        places: [],
        dishHits: [],
        emptyText: getModule(kind).emptyText,
        selectedCount: orderMode ? domain.cartCount() : 0
      };
    }

    const k = hay(String(keyword || '').trim());
    const cat = category ? normalizeCategory(category) : '';
    const allDishes = domain.listDishes({ kind: DISH_KIND.DINE_OUT });
    const dishesInCat = cat
      ? allDishes.filter((d) => normalizeCategory(d.category) === cat)
      : allDishes;
    const brandKey =
      ctx && ctx.brandKey != null ? ctx.brandKey : this.data.brandKey;

    if (view === 'dishes' && placeId) {
      const filter = { placeId };
      if (cat) filter.category = cat;
      let list = dishItem.listByKind(kind, { filter });
      if (k) {
        list = list.filter(
          (it) =>
            hay(it.name).indexOf(k) >= 0 ||
            (it.tasteTags || []).some((t) => hay(t).indexOf(k) >= 0)
        );
      }
      const place = domain.getPlace(placeId);
      const region = place ? domain.getRegion(place.regionId) : null;
      const mall = place && place.mallId ? domain.getMall(place.mallId) : null;
      return {
        list: mark(list),
        places: [],
        dishHits: [],
        emptyText: list.length
          ? ''
          : k
            ? '这家没有匹配的菜'
            : '还没有单独记菜',
        placeTitle: place ? domain.placeLabel(place) : '餐馆',
        placeInfo: place
          ? {
              id: place.id,
              name: domain.placeLabel(place),
              storeName: '',
              regionName: region ? region.name : '',
              mallName: mall ? mall.name : '',
              address: place.address || '',
              note: place.note || '',
              navUrl: place.navUrl || '',
              branches: (place.branches || []).map((b) => ({
                id: b.id,
                name: b.name || '',
                address: b.address || '',
                note: b.note || '',
                navUrl: b.navUrl || ''
              }))
            }
          : null,
        selectedCount: orderMode ? domain.cartCount() : 0
      };
    }

    const byPlace = {};
    dishesInCat.forEach((d) => {
      const pid = d.placeId || '';
      if (!pid) return;
      if (!byPlace[pid]) byPlace[pid] = [];
      byPlace[pid].push(d);
    });

    const matched = domain.listPlaces().filter((p) => {
      if (isSeedPlace(p)) return false;
      const rows = byPlace[p.id] || [];
      if (cat && !rows.length) return false;
      if (!k) return true;
      const nameHit =
        hay(p.brandName).indexOf(k) >= 0 ||
        hay(p.storeName).indexOf(k) >= 0 ||
        hay(p.address).indexOf(k) >= 0;
      const dishHit = rows.some((d) => dishTextHit(d, k));
      return nameHit || dishHit;
    });

    if (view === 'branches' && brandKey) {
      const branches = matched.filter((p) => brandKeyOf(p) === brandKey);
      const places = branches.map((p) =>
        toPlaceRow(p, byPlace[p.id] || [], cartIds)
      );
      const title =
        (branches[0] && String(branches[0].brandName || '').trim()) || '分店';
      return {
        list: [],
        places,
        dishHits: [],
        emptyText: places.length ? '' : '没有分店',
        placeTitle: '',
        placeInfo: null,
        brandTitle: title,
        selectedCount: orderMode ? domain.cartCount() : 0
      };
    }

    const groups = {};
    const order = [];
    matched.forEach((p) => {
      const gk = brandKeyOf(p);
      if (!groups[gk]) {
        groups[gk] = {
          brandName: String(p.brandName || '').trim() || domain.placeLabel(p),
          list: []
        };
        order.push(gk);
      }
      groups[gk].list.push(p);
    });
    const places = order.map((gk) => {
      const g = groups[gk];
      const list = g.list;
      if (list.length === 1) {
        return toPlaceRow(list[0], byPlace[list[0].id] || [], cartIds);
      }
      let dishCount = 0;
      let picked = 0;
      const placeIds = list.map((p) => p.id);
      list.forEach((p) => {
        const rows = byPlace[p.id] || [];
        dishCount += rows.length;
        if (cartIds) picked += rows.filter((d) => cartIds.has(d.id)).length;
      });
      const names = list.map(branchLabel);
      return {
        id: `b-${gk}`,
        placeId: '',
        placeIds,
        brandKey: gk,
        branchCount: list.length,
        name: g.brandName,
        subLine: `${list.length} 家分店 · ${names.slice(0, 3).join(' / ')}${
          names.length > 3 ? ' 等' : ''
        }`,
        note: '',
        dishCount,
        picked
      };
    });

    let dishHits = [];
    if (k) {
      const filter = {};
      if (cat) filter.category = cat;
      dishHits = mark(
        dishItem.listByKind(kind, { filter }).filter(
          (it) =>
            hay(it.name).indexOf(k) >= 0 ||
            (it.tasteTags || []).some((t) => hay(t).indexOf(k) >= 0)
        )
      );
    }

    return {
      list: [],
      places,
      dishHits,
      emptyText:
        places.length || dishHits.length
          ? ''
          : k
            ? '没有匹配的餐馆或菜品'
            : '暂无餐馆，先录入美食',
      placeTitle: '',
      placeInfo: null,
      selectedCount: orderMode ? domain.cartCount() : 0
    };
  },

  refresh() {
    const built = this.buildListState();
    const patch = {
      list: built.list,
      places: built.places,
      dishHits: built.dishHits,
      selectedCount: built.selectedCount,
      placeInfo: built.placeInfo || null
    };
    if (built.emptyText != null) patch.emptyText = built.emptyText;
    if (built.placeTitle != null) patch.placeTitle = built.placeTitle;
    if (built.brandTitle != null) patch.brandTitle = built.brandTitle;
    this.setData(patch);
  },

  /** 仅更新勾选态，避免整表重建闪烁 */
  syncSelectionFromCart() {
    if (!this.data.orderMode) return;
    const cartIds = new Set(domain.cartGetDishIds());
    const patch = {};
    let changed = false;
    const markList = (key) => {
      const rows = this.data[key] || [];
      for (let i = 0; i < rows.length; i++) {
        const on = cartIds.has(rows[i].id);
        if (!!rows[i].selected !== on) {
          patch[`${key}[${i}].selected`] = on;
          changed = true;
        }
      }
    };
    markList('list');
    markList('dishHits');
    const places = this.data.places || [];
    const allDishes = domain.listDishes({ kind: DISH_KIND.DINE_OUT });
    for (let i = 0; i < places.length; i++) {
      const ids = places[i].placeIds || (places[i].placeId ? [places[i].placeId] : []);
      const n = allDishes.filter(
        (d) => ids.indexOf(d.placeId) >= 0 && cartIds.has(d.id)
      ).length;
      if ((places[i].picked || 0) !== n) {
        patch[`places[${i}].picked`] = n;
        changed = true;
      }
    }
    patch.selectedCount = domain.cartCount();
    if (changed || this.data.selectedCount !== patch.selectedCount) {
      this.setData(patch);
    }
  },

  onKeyword(e) {
    const keyword = (e.detail && e.detail.value) || '';
    this.setData({ keyword }, () => this.refresh());
  },

  onClearKeyword() {
    if (!this.data.keyword) return;
    this.setData({ keyword: '' }, () => this.refresh());
  },

  onPlaceTap(e) {
    const branchCount = Number(e.currentTarget.dataset.branches) || 1;
    const brandKey = e.currentTarget.dataset.brand || '';
    const placeId = e.currentTarget.dataset.id;
    if (branchCount > 1 && brandKey) {
      this.setData({ view: 'branches', brandKey, placeId: '', placeTitle: '' }, () => {
        this.refresh();
        wx.setNavigationBarTitle({
          title: this.data.brandTitle || '分店'
        });
      });
      return;
    }
    if (!placeId) return;
    const place = domain.getPlace(placeId);
    this.setData(
      {
        view: 'dishes',
        placeId,
        placeTitle: place ? domain.placeLabel(place) : '餐馆'
      },
      () => {
        wx.setNavigationBarTitle({
          title: this.data.placeTitle || '餐馆'
        });
        this.refresh();
      }
    );
  },

  onBackPlaces() {
    if (this.data.view === 'dishes' && this.data.brandKey) {
      this.setData({ view: 'branches', placeId: '', placeTitle: '', placeInfo: null }, () => {
        this.refresh();
        wx.setNavigationBarTitle({
          title: this.data.brandTitle || '分店'
        });
      });
      return;
    }
    this.setData(
      { view: 'places', placeId: '', placeTitle: '', brandKey: '', brandTitle: '', placeInfo: null },
      () => {
        const mod = getModule(this.data.kind);
        wx.setNavigationBarTitle({
          title: this.data.orderMode ? '点餐' : mod.name
        });
        this.refresh();
      }
    );
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
    if (this._fromSchedule) {
      routes.finishScheduleFlow(this._scheduleDate);
      return;
    }
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
        if (this._fromSchedule) {
          routes.finishScheduleFlow(this._scheduleDate);
          return;
        }
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

  openCustom() {
    this.setData({ showCustom: true, customName: '', customNote: '' });
  },

  closeCustom() {
    this.setData({ showCustom: false });
  },

  onCustomName(e) {
    this.setData({ customName: e.detail.value });
  },

  onCustomNote(e) {
    this.setData({ customNote: e.detail.value });
  },

  submitCustom() {
    const name = String(this.data.customName || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写菜名', icon: 'none' });
      return;
    }
    Promise.resolve(
      domain.cartAddCustom({
        name,
        note: this.data.customNote
      })
    )
      .then(() => {
        this.setData({ showCustom: false, customName: '', customNote: '' });
        this.syncSelectionFromCart();
        wx.showToast({ title: '已加入点餐', icon: 'success' });
      })
      .catch((err) => {
        wx.showToast({
          title: (err && err.message) || '加入失败',
          icon: 'none'
        });
      });
  },

  goEdit(e) {
    routes.go(
      routes.dishEdit({ id: e.currentTarget.dataset.id, kind: this.data.kind })
    );
  },

  onEditPlace() {
    const id = this.data.placeId;
    if (!id) return;
    routes.go(routes.placeEdit({ id }));
  },

  onOpenNav() {
    const url = this.data.placeInfo && this.data.placeInfo.navUrl;
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
    });
  },

  goAdd() {
    const placeId =
      this.data.placeFirst && this.data.view === 'dishes'
        ? this.data.placeId
        : '';
    routes.go(routes.dishEdit({ kind: this.data.kind, placeId }));
  },

  onBackPress() {
    if (this.data.placeFirst && this.data.view !== 'places') {
      this.onBackPlaces();
      return true;
    }
    return false;
  },

  noop() {}
});
