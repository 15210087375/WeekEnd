const TABS = [
  {
    pagePath: '/pages/home/index',
    text: '美食',
    icon: '/assets/tab-food.png',
    selectedIcon: '/assets/tab-food-active.png'
  },
  {
    pagePath: '/pages/fun/index',
    text: '娱乐',
    icon: '/assets/tab-browse.png',
    selectedIcon: '/assets/tab-browse-active.png'
  },
  {
    pagePath: '/pages/search/index',
    text: '搜索',
    icon: '/assets/tab-search.png',
    selectedIcon: '/assets/tab-search-active.png'
  },
  {
    pagePath: '/pages/mine/index',
    text: '我的',
    icon: '/assets/tab-mine.png',
    selectedIcon: '/assets/tab-mine-active.png'
  }
];

Component({
  properties: {
    selected: { type: Number, value: 0 }
  },
  data: {
    list: TABS
  },
  methods: {
    onTap(e) {
      const index = Number(e.currentTarget.dataset.index);
      const item = TABS[index];
      if (!item || index === this.data.selected) return;
      wx.switchTab({ url: item.pagePath });
    }
  }
});
