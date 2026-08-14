const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { formatDateTime } = require('../../utils/format');

Page({
  data: {
    filter: 'all',
    list: []
  },

  onShow() {
    this.reload();
  },

  reload() {
    const filter = this.data.filter;
    let list;
    if (filter === 'preorder') {
      list = domain.listPreorders();
    } else if (filter === 'open') {
      list = domain.listOpenOrders();
    } else if (filter === 'dined') {
      list = domain.listOrders({ status: 'dined' });
    } else {
      list = domain.listOrders();
    }
    list = list.map((o) => ({
      ...o,
      timeText: formatDateTime(o.updatedAt || o.createdAt),
      countText: `${(o.items && o.items.length) || o.itemCount || 0} 道`
    }));
    this.setData({ list });
  },

  onFilter(e) {
    const filter = e.currentTarget.dataset.id || 'all';
    this.setData({ filter }, () => this.reload());
  },

  goDetail(e) {
    routes.go(routes.orderDetail(e.currentTarget.dataset.id));
  }
});
