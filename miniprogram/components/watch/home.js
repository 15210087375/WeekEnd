const domain = require('../../domain/index');
const routes = require('../../config/routes');
const pickImages = require('../../utils/pickImages');
const imageStore = require('../../services/imageStore');
const { MOVIE_PLAN_STATUS, MOVIE_PLAN_STATUS_LABELS } = require('../../utils/constants');

const FILTER_ALL = 'all';
const FILTERS = [
  { id: FILTER_ALL, label: '全部' },
  { id: MOVIE_PLAN_STATUS.PLANNED, label: MOVIE_PLAN_STATUS_LABELS.planned },
  { id: MOVIE_PLAN_STATUS.WANT, label: MOVIE_PLAN_STATUS_LABELS.want },
  { id: MOVIE_PLAN_STATUS.WATCHED, label: MOVIE_PLAN_STATUS_LABELS.watched },
  { id: MOVIE_PLAN_STATUS.DROP, label: MOVIE_PLAN_STATUS_LABELS.drop }
];

const STATUS_CHIPS = [
  { id: MOVIE_PLAN_STATUS.WANT, label: MOVIE_PLAN_STATUS_LABELS.want },
  { id: MOVIE_PLAN_STATUS.PLANNED, label: MOVIE_PLAN_STATUS_LABELS.planned },
  { id: MOVIE_PLAN_STATUS.WATCHED, label: MOVIE_PLAN_STATUS_LABELS.watched },
  { id: MOVIE_PLAN_STATUS.DROP, label: MOVIE_PLAN_STATUS_LABELS.drop }
];

function withUrls(row) {
  return {
    ...row,
    images: imageStore.forView(row.images)
  };
}

Component({
  properties: {
    tab: { type: String, value: 'plan' }
  },
  data: {
    filters: FILTERS,
    statusChips: STATUS_CHIPS,
    filterStatus: FILTER_ALL,
    plans: [],
    plansEmpty: true,
    logs: [],
    logsEmpty: true,
    cinemas: [],
    cinemasEmpty: true,
    expandedId: ''
  },
  lifetimes: {
    attached() {
      const tab = this.data.tab === 'cinema' || this.data.tab === 'log' ? this.data.tab : 'plan';
      this.reload({ tab });
    }
  },
  pageLifetimes: {
    show() {
      this.reload();
    }
  },
  methods: {
    reload(extra) {
      const tab = (extra && extra.tab) || this.data.tab || 'plan';
      const filterStatus = this.data.filterStatus;
      const filter =
        filterStatus && filterStatus !== FILTER_ALL ? { status: filterStatus } : {};
      const patch = {};
      if (extra && extra.tab) {
        patch.tab = extra.tab;
        patch.expandedId = '';
      }
      if (tab === 'plan') {
        patch.plans = domain.listMoviePlans(filter).map(withUrls);
        patch.plansEmpty = !patch.plans.length;
      } else if (tab === 'log') {
        patch.logs = domain.listMovieLogs().map(withUrls);
        patch.logsEmpty = !patch.logs.length;
      } else {
        patch.cinemas = domain.listCinemas().map(withUrls);
        patch.cinemasEmpty = !patch.cinemas.length;
      }
      const expandedId = extra && extra.tab ? '' : this.data.expandedId;
      if (expandedId) {
        const list =
          tab === 'plan' ? patch.plans : tab === 'log' ? patch.logs : patch.cinemas;
        if (!list.some((row) => row.id === expandedId)) patch.expandedId = '';
      }
      this.setData(patch);
    },
    onTab(e) {
      this.reload({ tab: e.currentTarget.dataset.tab || 'plan' });
    },
    onFilter(e) {
      this.setData({ filterStatus: e.currentTarget.dataset.id || FILTER_ALL, expandedId: '' }, () =>
        this.reload()
      );
    },
    onToggle(e) {
      const id = e.currentTarget.dataset.id;
      this.setData({
        expandedId: this.data.expandedId === id ? '' : id
      });
    },
    noop() {},
    onPreview(e) {
      const tab = this.data.tab;
      const list =
        tab === 'log' ? this.data.logs : tab === 'cinema' ? this.data.cinemas : this.data.plans;
      pickImages.previewFromList(list, e);
    },
    patchPlan(id, extra) {
      const row = domain.getMoviePlan(id);
      if (!row) return;
      domain.saveMoviePlan({
        id: row.id,
        title: row.title,
        status: row.status,
        date: row.date,
        cinemaId: row.cinemaId,
        hallId: row.hallId,
        note: row.note,
        images: row.images,
        ...extra
      });
      this.reload();
    },
    onPickPlanStatus(e) {
      const id = e.currentTarget.dataset.id;
      const status = e.currentTarget.dataset.status;
      if (!id || !status) return;
      try {
        this.patchPlan(id, { status });
      } catch (err) {
        wx.showToast({ title: (err && err.message) || '更新失败', icon: 'none' });
      }
    },
    onPickLogScore(e) {
      const id = e.currentTarget.dataset.id;
      const n = Number(e.detail && e.detail.value);
      if (!id) return;
      const row = domain.getMovieLog(id);
      if (!row) return;
      try {
        domain.saveMovieLog({
          id: row.id,
          title: row.title,
          planId: row.planId,
          date: row.date,
          cinemaId: row.cinemaId,
          hallId: row.hallId,
          cost: row.cost,
          score: Number.isFinite(n) ? n : null,
          feeling: row.feeling,
          note: row.note,
          images: row.images
        });
        this.reload();
      } catch (err) {
        wx.showToast({ title: (err && err.message) || '更新失败', icon: 'none' });
      }
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
      routes.go(routes.cinemaEdit({ id: e.currentTarget.dataset.id }));
    },
    goCreateCinema() {
      routes.go(routes.cinemaEdit());
    },
    goHall(e) {
      routes.go(
        routes.cinemaHall({
          id: e.currentTarget.dataset.id,
          cinemaId: e.currentTarget.dataset.cinema
        })
      );
    },
    goAddHall(e) {
      routes.go(routes.cinemaHall({ cinemaId: e.currentTarget.dataset.cinema }));
    },
    goLog(e) {
      routes.go(routes.movieLogEdit({ id: e.currentTarget.dataset.id }));
    },
    goCreateLog() {
      routes.go(routes.movieLogEdit());
    },
    goPlanLog(e) {
      const logId = e.currentTarget.dataset.log;
      const planId = e.currentTarget.dataset.id;
      if (logId) routes.go(routes.movieLogEdit({ id: logId }));
      else routes.go(routes.movieLogEdit({ planId }));
    }
  }
});
