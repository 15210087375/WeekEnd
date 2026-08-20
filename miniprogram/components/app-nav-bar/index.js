Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    showBack: {
      type: Boolean,
      value: false
    },
    fixed: {
      type: Boolean,
      value: false
    }
  },

  data: {
    statusBarHeight: 20,
    innerHeight: 44,
    totalHeight: 64
  },

  lifetimes: {
    attached() {
      let statusBarHeight = 20;
      try {
        const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        statusBarHeight = sys.statusBarHeight || 20;
      } catch (e) {
        // ignore
      }

      let innerHeight = 44;
      try {
        const menu = wx.getMenuButtonBoundingClientRect();
        if (menu && menu.height) {
          innerHeight = menu.height + (menu.top - statusBarHeight) * 2;
        }
      } catch (e) {
        // ignore
      }

      const totalHeight = statusBarHeight + innerHeight;
      this.setData({ statusBarHeight, innerHeight, totalHeight });
      this.triggerEvent('ready', { height: totalHeight });
    }
  },

  methods: {
    onBack() {
      this.triggerEvent('back');
    }
  }
});
