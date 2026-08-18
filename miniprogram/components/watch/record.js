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
const { MOVIE_PLAN_STATUS } = require('../../utils/constants');

function todayStr() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

Component({
  properties: {
    recordId: { type: String, value: '' },
    fromPlanId: { type: String, value: '' }
  },
  data: {
    id: '',
    planId: '',
    title: '',
    date: '',
    dateText: '',
    dateRange: [[], [], [], []],
    dateIndex: [0, 0, 0, 0],
    cinemaId: '',
    hallId: '',
    costText: '',
    score: 0,
    feeling: '',
    note: '',
    images: [],
    cinemas: [],
    halls: [],
    fromPlan: false,
    _ownerId: ''
  },
  lifetimes: {
    attached() {
      const id = this.data.recordId || '';
      const planId = this.data.fromPlanId || '';
      const picker = buildDatePicker('');
      this.setData({
        cinemas: domain.listCinemas(),
        dateRange: picker.range,
        dateIndex: picker.index
      });
      if (id) {
        const row = domain.getMovieLog(id);
        if (!row) {
          wx.showToast({ title: '记录不存在', icon: 'none' });
          return;
        }
        this.applyLog(row);
        return;
      }
      if (planId) {
        const existing = domain.getMovieLogByPlan(planId);
        if (existing) {
          this.applyLog(existing);
          return;
        }
        const plan = domain.getMoviePlan(planId);
        if (!plan) {
          wx.showToast({ title: '计划不存在', icon: 'none' });
          return;
        }
        this.setData({
          planId,
          title: plan.title || '',
          date: plan.date || todayStr(),
          dateText: formatDateWeekday(plan.date || todayStr()),
          ...(() => {
            const p = buildDatePicker(plan.date || todayStr());
            return { dateRange: p.range, dateIndex: p.index };
          })(),
          cinemaId: plan.cinemaId || '',
          hallId: plan.hallId || '',
          halls: plan.cinemaId ? domain.listCinemaHalls(plan.cinemaId) : [],
          fromPlan: true,
          _ownerId: uuid()
        });
        return;
      }
      this.setData({
        date: todayStr(),
        dateText: formatDateWeekday(todayStr()),
        _ownerId: uuid(),
        ...(() => {
          const p = buildDatePicker(todayStr());
          return { dateRange: p.range, dateIndex: p.index };
        })()
      });
    }
  },
  methods: {
    applyLog(row) {
      this.setData({
        id: row.id,
        planId: row.planId || '',
        title: row.title || '',
        date: row.date || '',
        dateText: formatDateWeekday(row.date || ''),
        ...(() => {
          const p = buildDatePicker(row.date || '');
          return { dateRange: p.range, dateIndex: p.index };
        })(),
        cinemaId: row.cinemaId || '',
        hallId: row.hallId || '',
        costText: row.cost != null ? String(row.cost) : '',
        score: row.score || 0,
        feeling: row.feeling || '',
        note: row.note || '',
        images: row.images || [],
        halls: row.cinemaId ? domain.listCinemaHalls(row.cinemaId) : [],
        fromPlan: !!row.planId,
        _ownerId: row.id
      });
    },
    onTitle(e) {
      this.setData({ title: e.detail.value });
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
    onCost(e) {
      this.setData({ costText: e.detail.value });
    },
    onFeeling(e) {
      this.setData({ feeling: e.detail.value });
    },
    onNote(e) {
      this.setData({ note: e.detail.value });
    },
    onPickScore(e) {
      const n = Number(e.detail && e.detail.value);
      this.setData({ score: Number.isFinite(n) ? n : 0 });
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
    persist() {
      const row = domain.saveMovieLog({
        id: this.data.id || this.data._ownerId,
        planId: this.data.planId,
        title: this.data.title,
        date: this.data.date,
        cinemaId: this.data.cinemaId,
        hallId: this.data.hallId,
        cost: this.data.costText,
        score: this.data.score || null,
        feeling: this.data.feeling,
        note: this.data.note,
        images: this.data.images
      });
      if (this.data.planId) {
        const plan = domain.getMoviePlan(this.data.planId);
        if (plan && plan.status !== MOVIE_PLAN_STATUS.WATCHED) {
          domain.saveMoviePlan({ ...plan, status: MOVIE_PLAN_STATUS.WATCHED });
        }
      }
      this.setData({ id: row.id });
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
    onDelete() {
      if (!this.data.id) return;
      wx.showModal({
        title: '删除记录',
        content: '删除后不可恢复。',
        success: (res) => {
          if (!res.confirm) return;
          try {
            domain.deleteMovieLog(this.data.id);
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
