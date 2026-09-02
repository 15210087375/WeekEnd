const routes = require('../../config/routes');
const domain = require('../../domain/index');

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

  onShow() {
    if (domain.syncRefresh) {
      domain.syncRefresh({ reason: 'tab', buckets: ['fun'] }).catch(() => {});
    }
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
      routes.go(routes.watch());
      return;
    }
    if (id === 'note') {
      routes.go(routes.noteList());
    }
  }
});
