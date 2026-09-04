const domain = require('../../domain/index');
const routes = require('../../config/routes');
const fabReveal = require('../../behaviors/fabReveal');
const { uuid } = require('../../utils/id');
const pickImages = require('../../utils/pickImages');
const { MOVIE_PLAN_STATUS } = require('../../utils/constants');

function todayStr() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

Page({
  behaviors: [fabReveal],
  data: {
    id: '',
    planId: '',
    title: '',
    date: '',
    cinemaId: '',
    cinemaIds: [],
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

  onLoad(query) {
    const id = (query && query.id) || '';
    const planId = (query && query.planId) || '';
    this.setData({
      cinemas: domain.listCinemas()
    });

    if (id) {
      const row = domain.getMovieLog(id);
      if (!row) {
        wx.showToast({ title: '记录不存在', icon: 'none' });
        return;
      }
      this.applyLog(row);
      wx.setNavigationBarTitle({ title: '编辑观影记录' });
      return;
    }

    if (planId) {
      const existing = domain.getMovieLogByPlan(planId);
      if (existing) {
        this.applyLog(existing);
        wx.setNavigationBarTitle({ title: '编辑观影记录' });
        return;
      }
      const plan = domain.getMoviePlan(planId);
      if (!plan) {
        wx.showToast({ title: '计划不存在', icon: 'none' });
        return;
      }
      const cinemaIds = domain.normalizeMovieIds(plan.cinemaIds, plan.cinemaId);
      const cinemaId =
        plan.cinemaId || (cinemaIds.length === 1 ? cinemaIds[0] : '');
      this.setData({
        id: '',
        planId,
        title: plan.title || '',
        date: plan.date || todayStr(),
        cinemaId,
        cinemaIds,
        hallId: cinemaId ? plan.hallId || '' : '',
        images: [],
        cinemas: domain.markMovieSelected(domain.listCinemas(), cinemaIds, cinemaId, false),
        halls: cinemaId ? domain.listCinemaHalls(cinemaId) : [],
        fromPlan: true,
        _ownerId: uuid()
      });
      wx.setNavigationBarTitle({ title: '写观影记录' });
      return;
    }

    this.setData({
      date: todayStr(),
      _ownerId: uuid()
    });
    wx.setNavigationBarTitle({ title: '写观影记录' });
  },

  applyLog(row) {
    const plan = row.planId ? domain.getMoviePlan(row.planId) : null;
    const cinemaIds = domain.normalizeMovieIds(
      plan && plan.cinemaIds,
      row.cinemaId || (plan && plan.cinemaId)
    );
    this.setData({
      id: row.id,
      planId: row.planId || '',
      title: row.title || '',
      date: row.date || '',
      cinemaId: row.cinemaId || '',
      cinemaIds,
      hallId: row.hallId || '',
      costText: row.cost != null ? String(row.cost) : '',
      score: row.score || 0,
      feeling: row.feeling || '',
      note: row.note || '',
      images: row.images || [],
      cinemas: domain.markMovieSelected(
        domain.listCinemas(),
        cinemaIds,
        row.cinemaId || '',
        false
      ),
      halls: row.cinemaId ? domain.listCinemaHalls(row.cinemaId) : [],
      fromPlan: !!row.planId,
      _ownerId: row.id
    });
  },

  onTitle(e) {
    this.setData({ title: e.detail.value });
  },

  onDate(e) {
    this.setData({ date: e.detail.value });
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
      cinemas: domain.markMovieSelected(
        domain.listCinemas(),
        this.data.cinemaIds,
        next,
        false
      ),
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
        domain.saveMoviePlan({
          ...plan,
          status: MOVIE_PLAN_STATUS.WATCHED
        });
      }
    }
    this.setData({ id: row.id });
    return row;
  },

  onSave() {
    try {
      this.persist();
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => routes.back(routes.watch({ tab: 'log' })), 350);
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
          setTimeout(() => routes.back(routes.watch({ tab: 'log' })), 350);
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '删除失败', icon: 'none' });
        }
      }
    });
  }
});
