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
    planId: { type: String, value: '' }
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
    }
  },
  methods: {
    loadPlan(id) {
      const row = domain.getMoviePlan(id);
      if (!row) {
        wx.showToast({ title: '记录不存在', icon: 'none' });
        return;
      }
      const halls = row.cinemaId ? domain.listCinemaHalls(row.cinemaId) : [];
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
        cinemaId: row.cinemaId || '',
        hallId: row.hallId || '',
        images: row.images || [],
        halls,
        linkedLogId: row.linkedLogId || ''
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
      this.setData({ status: e.currentTarget.dataset.id });
    },
    onPickCinema(e) {
      const cinemaId = e.currentTarget.dataset.id || '';
      const next = this.data.cinemaId === cinemaId ? '' : cinemaId;
      this.setData({
        cinemaId: next,
        hallId: '',
        halls: next ? domain.listCinemaHalls(next) : []
      });
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
      const row = domain.saveMoviePlan({
        id: this.data.id || this.data._ownerId,
        title: this.data.title,
        status: (extra && extra.status) || this.data.status,
        date: this.data.date,
        note: this.data.note,
        cinemaId: this.data.cinemaId,
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
