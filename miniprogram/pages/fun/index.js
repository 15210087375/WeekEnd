const routes = require('../../config/routes');

Page({
  data: {
    modules: [
      {
        id: 'wish',
        title: '心愿单',
        desc: '想买/想做的目标：状态、分类、参考价与照片',
        ready: true
      },
      {
        id: 'shop',
        title: '门店购物',
        desc: '记录逛过的店、买过的东西',
        ready: false
      },
      {
        id: 'note',
        title: '娱乐备注',
        desc: '随手记的想法与清单',
        ready: false
      },
      {
        id: 'cinema',
        title: '影院',
        desc: '常去影院与场馆信息',
        ready: false
      },
      {
        id: 'movie_plan',
        title: '观影计划',
        desc: '想看的电影与观影安排',
        ready: false
      }
    ]
  },

  onOpen(e) {
    const id = e.currentTarget.dataset.id;
    const mod = (this.data.modules || []).find((m) => m.id === id);
    if (!mod || !mod.ready) {
      wx.showToast({ title: '即将推出', icon: 'none' });
      return;
    }
    if (id === 'wish') {
      routes.go(routes.wishList());
    }
  }
});
