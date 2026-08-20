const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { MOVIE_PLAN_STATUS, MOVIE_PLAN_STATUS_LABELS } = require('../../utils/constants');

const FILTER_ALL = 'all';
const FILTERS = [
  { id: FILTER_ALL, label: '全部' },
  { id: MOVIE_PLAN_STATUS.PLANNED, label: MOVIE_PLAN_STATUS_LABELS.planned },
  { id: MOVIE_PLAN_STATUS.WANT, label: MOVIE_PLAN_STATUS_LABELS.want },
  { id: MOVIE_PLAN_STATUS.WATCHED, label: MOVIE_PLAN_STATUS_LABELS.watched },
  { id: MOVIE_PLAN_STATUS.DROP, label: MOVIE_PLAN_STATUS_LABELS.drop }
];

Page({
  data: {
    tab: 'plan',
    filters: FILTERS,
    filterStatus: FILTER_ALL,
    plans: [],
    plansEmpty: true,
    logs: [],
    logsEmpty: true,
    cinemas: [],
    cinemasEmpty: true
  },

  onLoad(query) {
    const raw = query && query.tab;
    const tab = raw === 'cinema' || raw === 'log' ? raw : 'plan';
    // 只填当前 Tab：navigate 要等 onLoad 结束才滑入
    this._bootstrapped = true;
    this.reload({ tab });
  },

  onShow() {
    if (this._bootstrapped) {
      this._bootstrapped = false;
      return;
    }
    this.reload();
  },

  reload(extra) {
    const tab = (extra && extra.tab) || this.data.tab || 'plan';
    const filterStatus = this.data.filterStatus;
    const filter =
      filterStatus && filterStatus !== FILTER_ALL ? { status: filterStatus } : {};
    const patch = {};
    if (extra && extra.tab) patch.tab = extra.tab;
    if (tab === 'plan') {
      patch.plans = domain.listMoviePlans(filter);
      patch.plansEmpty = !patch.plans.length;
    } else if (tab === 'log') {
      patch.logs = domain.listMovieLogs();
      patch.logsEmpty = !patch.logs.length;
    } else {
      patch.cinemas = domain.listCinemas();
      patch.cinemasEmpty = !patch.cinemas.length;
    }
    this.setData(patch);
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab || 'plan';
    this.reload({ tab });
  },

  onFilter(e) {
    this.setData({ filterStatus: e.currentTarget.dataset.id || FILTER_ALL }, () =>
      this.reload()
    );
  },

  goPlan(e) {
    routes.go(routes.moviePlanEdit({ id: e.currentTarget.dataset.id }));
  },

  onFabClick() {
    const tab = this.data.tab;
    if (tab === 'log') {
      this.goCreateLog();
      return;
    }
    if (tab === 'cinema') {
      this.goCreateCinema();
      return;
    }
    this.goCreatePlan();
  },

  goCreatePlan() {
    routes.go(routes.moviePlanEdit());
  },

  goCinema(e) {
    routes.go(routes.cinemaDetail(e.currentTarget.dataset.id));
  },

  goCreateCinema() {
    routes.go(routes.cinemaEdit());
  },

  goLog(e) {
    routes.go(routes.movieLogEdit({ id: e.currentTarget.dataset.id }));
  },

  goCreateLog() {
    routes.go(routes.movieLogEdit());
  }
});
