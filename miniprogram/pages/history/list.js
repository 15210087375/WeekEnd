const dishItem = require('../../presenters/dishItem');
const routes = require('../../config/routes');
const { DISH_KIND } = require('../../utils/constants');

Page({
  data: {
    kind: '',
    list: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const filter = this.data.kind ? { kind: this.data.kind } : {};
    this.setData({
      list: dishItem.search(filter, { mode: 'history' })
    });
  },

  onKindChange(e) {
    const kind = e.currentTarget.dataset.kind;
    if (kind === this.data.kind) return;
    this.setData({ kind }, () => this.refresh());
  },

  goDetail(e) {
    routes.go(routes.dishDetail(e.currentTarget.dataset.id));
  }
});
