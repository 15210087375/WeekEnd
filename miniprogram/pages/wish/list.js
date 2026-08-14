const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { formatDateTime } = require('../../utils/format');
const {
  WISH_STATUS,
  WISH_STATUS_LABELS
} = require('../../utils/constants');

const FILTER_ALL = 'all';

const FILTERS = [
  { id: FILTER_ALL, label: '全部' },
  { id: WISH_STATUS.WANT, label: WISH_STATUS_LABELS.want },
  { id: WISH_STATUS.DOING, label: WISH_STATUS_LABELS.doing },
  { id: WISH_STATUS.DONE, label: WISH_STATUS_LABELS.done },
  { id: WISH_STATUS.DROP, label: WISH_STATUS_LABELS.drop }
];

Page({
  data: {
    filters: FILTERS,
    filterStatus: FILTER_ALL,
    list: [],
    empty: true
  },

  onShow() {
    this.reload();
  },

  reload() {
    const filterStatus = this.data.filterStatus;
    const filter =
      filterStatus && filterStatus !== FILTER_ALL ? { status: filterStatus } : {};
    const list = domain.listWishes(filter).map((w) => ({
      ...w,
      timeText: formatDateTime(w.updatedAt),
      thumb: w.images && w.images[0] ? w.images[0].localPath : '',
      isPrivate: w.visibility === 'private'
    }));
    this.setData({ list, empty: !list.length });
  },

  onFilter(e) {
    const id = e.currentTarget.dataset.id || FILTER_ALL;
    this.setData({ filterStatus: String(id) }, () => this.reload());
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    routes.go(routes.wishEdit({ id }));
  },

  goCreate() {
    routes.go(routes.wishEdit());
  }
});
