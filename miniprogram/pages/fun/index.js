const routes = require('../../config/routes');
const domain = require('../../domain/index');
const funStack = require('../../utils/funStack');

Page({
  data: {
    modules: [
      {
        id: 'schedule',
        title: '日程',
        desc: '当天安排与待办',
        icon: '/assets/fun/icon_noteTime.png',
        ready: true
      },
      {
        id: 'wish',
        title: '心愿单',
        desc: '想买、想做的目标',
        icon: '/assets/fun/icon_wish.png',
        ready: true
      },
      {
        id: 'shop',
        title: '购物',
        desc: '店名、金额与小票',
        icon: '/assets/fun/icon_shopping.png',
        ready: true
      },
      {
        id: 'watch',
        title: '观影',
        desc: '想看的片与影院',
        icon: '/assets/fun/icon_movie.png',
        ready: true
      },
      {
        id: 'note',
        title: '随笔',
        desc: '随手记，默认仅自己可见',
        icon: '/assets/fun/icon_suibi.png',
        ready: true
      }
    ],
    layers: [],
    navTitle: '娱乐',
    showBack: false,
    navTotal: 64
  },

  onNavReady(e) {
    const height = e.detail && e.detail.height;
    if (height) {
      this.setData({ navTotal: height });
    }
  },

  syncNav() {
    const layers = this.data.layers || [];
    const top = layers[layers.length - 1];
    this.setData({
      navTitle: top && top.title ? top.title : '娱乐',
      showBack: layers.length > 0
    });
  },

  onShow() {
    funStack.attach(this);
    try {
      const app = getApp();
      const pending = app && app.globalData && app.globalData.pendingFunLayer;
      if (pending && pending.name) {
        app.globalData.pendingFunLayer = null;
        this.pushFunLayer(pending.name, pending.params || {}, pending.title || '');
      }
    } catch (e) {
      // ignore
    }
    if (domain.syncRefresh) {
      domain.syncRefresh({ reason: 'tab', buckets: ['fun'] }).catch(() => {});
    }
  },

  onHide() {
    funStack.detach(this);
  },

  onUnload() {
    funStack.detach(this);
  },

  onBackPress() {
    return this.popFunLayer();
  },

  onOpen(e) {
    const id = e.currentTarget.dataset.id;
    const mod = (this.data.modules || []).find((m) => m.id === id);
    if (!mod || !mod.ready) {
      wx.showToast({ title: '即将推出', icon: 'none' });
      return;
    }
    if (id === 'schedule') {
      routes.go(routes.scheduleDay());
      return;
    }
    if (id === 'wish') {
      routes.go(routes.wishList());
      return;
    }
    if (id === 'shop') {
      routes.go(routes.shopList());
      return;
    }
    if (id === 'watch') {
      this.pushFunLayer('watch', { tab: 'plan' }, '观影');
      return;
    }
    if (id === 'note') {
      routes.go(routes.noteList());
    }
  },

  pushFunLayer(name, params, title) {
    const key = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const layer = { key, name, params: params || {}, title: title || '', inn: false };
    const layers = (this.data.layers || []).concat([layer]);
    this.setData({ layers }, () => this.syncNav());
    setTimeout(() => {
      const next = (this.data.layers || []).map((item) =>
        item.key === key ? { ...item, inn: true } : item
      );
      this.setData({ layers: next });
    }, 16);
  },

  replaceFunLayer(name, params, title) {
    const layers = (this.data.layers || []).slice();
    if (!layers.length) {
      this.pushFunLayer(name, params, title);
      return;
    }
    layers[layers.length - 1] = {
      key: `${Date.now()}_r`,
      name,
      params: params || {},
      title: title || '',
      inn: true
    };
    this.setData({ layers }, () => this.syncNav());
  },

  popFunLayer() {
    const layers = (this.data.layers || []).slice();
    if (!layers.length) return false;
    const last = layers[layers.length - 1];
    last.inn = false;
    const preview = layers.slice(0, -1);
    const previewTop = preview[preview.length - 1];
    this.setData({
      layers,
      navTitle: previewTop && previewTop.title ? previewTop.title : '娱乐',
      showBack: preview.length > 0
    });
    setTimeout(() => {
      const next = (this.data.layers || []).filter((item) => item.key !== last.key);
      this.setData({ layers: next }, () => this.syncNav());
      const top = next[next.length - 1];
      if (top && top.name === 'watch') {
        const c = this.selectComponent('#watchHome');
        if (c && c.reload) c.reload();
      }
      if (top && top.name === 'cinemaDetail') {
        const c = this.selectComponent('#cinemaDetail');
        if (c && c.reload) c.reload();
      }
    }, 280);
    return true;
  }
});
