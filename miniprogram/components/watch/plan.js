const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { uuid } = require('../../utils/id');
const pickImages = require('../../utils/pickImages');
const {
  formatDateWeekday,
  buildDatePicker,
  ymdFromPicker,
  shiftDatePicker
} = require('../../utils/format');
const {
  MOVIE_PLAN_STATUS,
  MOVIE_PLAN_STATUS_LABELS
} = require('../../utils/constants');

const STATUS_OPTIONS = [
  { id: MOVIE_PLAN_STATUS.WANT, label: MOVIE_PLAN_STATUS_LABELS.want },
  { id: MOVIE_PLAN_STATUS.PLANNED, label: MOVIE_PLAN_STATUS_LABELS.planned },
  { id: MOVIE_PLAN_STATUS.WATCHED, label: MOVIE_PLAN_STATUS_LABELS.watched },
  { id: MOVIE_PLAN_STATUS.DROP, label: MOVIE_PLAN_STATUS_LABELS.drop }
];

Component({
  properties: {
    planId: { type: String, value: '' },
    presetDate: { type: String, value: '' }
  },
  data: {
    id: '',
    title: '',
    status: MOVIE_PLAN_STATUS.WANT,
    date: '',
    dateText: '',
    dateRange: [[], [], [], []],
    dateIndex: [0, 0, 0, 0],
    note: '',
    cinemaId: '',
    cinemaIds: [],
    cinemaMulti: true,
    hallId: '',
    images: [],
    cinemas: [],
    halls: [],
    statusOptions: STATUS_OPTIONS,
    linkedLogId: '',
    _ownerId: ''
  },
  lifetimes: {
    attached() {
      const id = this.data.planId || '';
      const picker = buildDatePicker('');
      this.setData({
        id,
        _ownerId: id || uuid(),
        cinemas: domain.listCinemas(),
        dateRange: picker.range,
        dateIndex: picker.index
      });
      if (id) this.loadPlan(id);
      else if (this.data.presetDate) {
        const date = String(this.data.presetDate).slice(0, 10);
        const picker = buildDatePicker(date);
        this.setData({
          date,
          dateText: formatDateWeekday(date),
          dateRange: picker.range,
          dateIndex: picker.index
        });
      }
    }
  },
  methods: {
    loadPlan(id) {
      const row = domain.getMoviePlan(id);
      if (!row) {
        wx.showToast({ title: '记录不存在', icon: 'none' });
        return;
      }
      const cinemaIds = domain.normalizeMovieIds(row.cinemaIds, row.cinemaId);
      const cinemaMulti = !domain.isMovieWatched(row.status);
      const cinemaId =
        row.cinemaId ||
        (!cinemaMulti && cinemaIds.length === 1 ? cinemaIds[0] : row.cinemaId || '');
      const halls = cinemaId ? domain.listCinemaHalls(cinemaId) : [];
      this.setData({
        title: row.title || '',
        status: row.status || MOVIE_PLAN_STATUS.WANT,
        date: row.date || '',
        dateText: formatDateWeekday(row.date || ''),
        ...(() => {
          const p = buildDatePicker(row.date || '');
          return { dateRange: p.range, dateIndex: p.index };
        })(),
        note: row.note || '',
        cinemaId,
        cinemaIds,
        cinemaMulti,
        hallId: row.hallId || '',
        images: row.images || [],
        cinemas: domain.markMovieSelected(
          domain.listCinemas(),
          cinemaIds,
          cinemaId,
          cinemaMulti
        ),
        halls,
        linkedLogId: row.linkedLogId || ''
      });
    },
    paintCinemas(patch) {
      const cinemaIds = patch.cinemaIds != null ? patch.cinemaIds : this.data.cinemaIds;
      const cinemaId = patch.cinemaId != null ? patch.cinemaId : this.data.cinemaId;
      const cinemaMulti =
        patch.cinemaMulti != null ? patch.cinemaMulti : this.data.cinemaMulti;
      const hallId = patch.hallId != null ? patch.hallId : this.data.hallId;
      const showHall = cinemaMulti ? cinemaIds.length === 1 : !!cinemaId;
      const hallCinemaId = cinemaMulti && cinemaIds.length === 1 ? cinemaIds[0] : cinemaId;
      this.setData({
        ...patch,
        cinemas: domain.markMovieSelected(
          domain.listCinemas(),
          cinemaIds,
          cinemaId,
          cinemaMulti
        ),
        halls: showHall ? domain.listCinemaHalls(hallCinemaId) : [],
        hallId: showHall ? hallId : ''
      });
    },
    onTitle(e) {
      this.setData({ title: e.detail.value });
    },
    onNote(e) {
      this.setData({ note: e.detail.value });
    },
    onDateColumn(e) {
      const col = Number(e.detail.column);
      const idx = Number(e.detail.value);
      const range = (this.data.dateRange || []).map((colRange) => colRange.slice());
      const index = (this.data.dateIndex || [0, 0, 0, 0]).slice();
      index[col] = idx;
      const next = shiftDatePicker(range, index, col);
      this.setData({ dateRange: next.range, dateIndex: next.index });
    },
    onDatePick(e) {
      const index = (e.detail.value || []).slice();
      const date = ymdFromPicker(this.data.dateRange, index);
      const picker = buildDatePicker(date);
      this.setData({
        date,
        dateText: formatDateWeekday(date),
        dateRange: picker.range,
        dateIndex: picker.index
      });
    },
    onPickStatus(e) {
      const status = e.currentTarget.dataset.id;
      const cinemaMulti = !domain.isMovieWatched(status);
      let cinemaId = this.data.cinemaId;
      const cinemaIds = (this.data.cinemaIds || []).slice();
      if (!cinemaMulti && !cinemaId && cinemaIds.length === 1) cinemaId = cinemaIds[0];
      this.paintCinemas({ status, cinemaMulti, cinemaId, cinemaIds });
    },
    onPickCinema(e) {
      const id = e.currentTarget.dataset.id || '';
      if (!id) return;
      if (this.data.cinemaMulti) {
        const cinemaIds = (this.data.cinemaIds || []).slice();
        const i = cinemaIds.indexOf(id);
        if (i >= 0) cinemaIds.splice(i, 1);
        else cinemaIds.push(id);
        const cinemaId =
          cinemaIds.indexOf(this.data.cinemaId) >= 0 ? this.data.cinemaId : '';
        this.paintCinemas({ cinemaIds, cinemaId, hallId: '' });
        return;
      }
      const cinemaId = this.data.cinemaId === id ? '' : id;
      let cinemaIds = (this.data.cinemaIds || []).slice();
      if (cinemaId && cinemaIds.indexOf(cinemaId) < 0) cinemaIds.push(cinemaId);
      this.paintCinemas({ cinemaId, cinemaIds, hallId: '' });
    },
    onPickHall(e) {
      const hallId = e.currentTarget.dataset.id || '';
      this.setData({ hallId: this.data.hallId === hallId ? '' : hallId });
    },
    onAddShot() {
      pickImages.chooseScreenshots({
        images: this.data.images,
        ownerId: this.data._ownerId,
        onDone: (images) => this.setData({ images })
      });
    },
    onPreviewShot(e) {
      pickImages.previewImages(this.data.images, Number(e.currentTarget.dataset.index));
    },
    onRemoveShot(e) {
      this.setData({
        images: pickImages.removeAt(this.data.images, Number(e.currentTarget.dataset.index))
      });
    },
    persist(extra) {
      const status = (extra && extra.status) || this.data.status;
      if (
        domain.isMovieWatched(status) &&
        (this.data.cinemaIds || []).length > 1 &&
        !this.data.cinemaId
      ) {
        throw new Error('请选择最终去的影院');
      }
      const row = domain.saveMoviePlan({
        id: this.data.id || this.data._ownerId,
        title: this.data.title,
        status,
        date: this.data.date,
        note: this.data.note,
        cinemaId: this.data.cinemaId,
        cinemaIds: this.data.cinemaIds,
        hallId: this.data.hallId,
        images: this.data.images
      });
      this.setData({
        id: row.id,
        status: row.status,
        linkedLogId: row.linkedLogId || ''
      });
      return row;
    },
    onSave() {
      try {
        this.persist();
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(() => routes.back(), 350);
      } catch (e) {
        wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' });
      }
    },
    goWriteLog() {
      try {
        if ((this.data.cinemaIds || []).length > 1 && !this.data.cinemaId) {
          this.paintCinemas({
            status: MOVIE_PLAN_STATUS.WATCHED,
            cinemaMulti: false
          });
          wx.showToast({ title: '请选择最终去的影院', icon: 'none' });
          return;
        }
        const plan = this.persist({ status: MOVIE_PLAN_STATUS.WATCHED });
        const existing = domain.getMovieLogByPlan(plan.id);
        routes.go(
          existing
            ? routes.movieLogEdit({ id: existing.id })
            : routes.movieLogEdit({ planId: plan.id })
        );
      } catch (e) {
        wx.showToast({ title: (e && e.message) || '请先填片名', icon: 'none' });
      }
    },
    onDelete() {
      if (!this.data.id) return;
      wx.showModal({
        title: '删除片子',
        content: '删除后不可恢复。',
        success: (res) => {
          if (!res.confirm) return;
          try {
            domain.deleteMoviePlan(this.data.id);
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => routes.back(), 350);
          } catch (e) {
            wx.showToast({ title: (e && e.message) || '删除失败', icon: 'none' });
          }
        }
      });
    }
  }
});
