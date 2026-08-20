const domain = require('../../domain/index');
const routes = require('../../config/routes');
const fabReveal = require('../../behaviors/fabReveal');
const { DISH_KIND, SCHEDULE_TYPES, SHOP_STATUS } = require('../../utils/constants');
const {
  formatDateWeekday,
  buildDatePicker,
  ymdFromPicker,
  shiftDatePicker
} = require('../../utils/format');

Page({
  behaviors: [fabReveal],
  data: {
    id: '',
    title: '',
    note: '',
    type: 'none',
    date: '',
    dateText: '',
    dateRange: [[], [], [], []],
    dateIndex: [0, 0, 0, 0],
    types: SCHEDULE_TYPES
  },

  onLoad(query) {
    const id = (query && query.id) || '';
    const date = (query && query.date) || domain.scheduleToday();
    const picker = buildDatePicker(date);
    this.setData({
      id,
      date,
      dateText: formatDateWeekday(date),
      dateRange: picker.range,
      dateIndex: picker.index
    });
    wx.setNavigationBarTitle({
      title: id ? '编辑日程' : '添加日程'
    });
  },

  onShow() {
    if (!this.data.id || this._loaded) return;
    const row = domain.getSchedule(this.data.id);
    if (!row) {
      wx.showToast({ title: '日程不存在', icon: 'none' });
      return;
    }
    this._loaded = true;
    const date = row.date || domain.scheduleToday();
    const picker = buildDatePicker(date);
    this.setData({
      title: row.title || '',
      note: row.note || '',
      type: row.type || 'none',
      date,
      dateText: formatDateWeekday(date),
      dateRange: picker.range,
      dateIndex: picker.index
    });
  },

  onTitle(e) {
    this.setData({ title: e.detail.value });
  },

  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  onPickType(e) {
    this.setData({ type: e.currentTarget.dataset.id || 'none' });
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

  jumpAfterSave(type, date) {
    if (type === 'watch') {
      routes.go(routes.moviePlanEdit({ date }));
      return;
    }
    if (type === 'dine') {
      routes.go(routes.archiveList(DISH_KIND.DINE_OUT, { order: '1', date }));
      return;
    }
    if (type === 'cook') {
      routes.go(routes.archiveList(DISH_KIND.HOMEMADE, { order: '1', date }));
      return;
    }
    routes.back(routes.scheduleDay({ date }));
  },

  onSave() {
    try {
      if (this.data.type === 'shop') {
        domain.saveShopLog({
          storeName: this.data.title,
          title: '',
          date: this.data.date,
          note: this.data.note,
          status: SHOP_STATUS.PLANNED
        });
        wx.showToast({ title: '已加入购物计划', icon: 'success' });
        setTimeout(
          () => routes.back(routes.scheduleDay({ date: this.data.date })),
          400
        );
        return;
      }
      const row = domain.saveSchedule({
        id: this.data.id,
        title: this.data.title,
        date: this.data.date,
        type: this.data.type,
        note: this.data.note
      });
      this.setData({ id: row.id });
      this._loaded = true;
      const type = row.type || 'none';
      if (type === 'none') {
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(() => routes.back(routes.scheduleDay({ date: row.date })), 400);
        return;
      }
      this.jumpAfterSave(type, row.date);
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' });
    }
  },

  onDelete() {
    if (!this.data.id) return;
    wx.showModal({
      title: '删除这条',
      content: '删除后不可恢复，确定？',
      success: (res) => {
        if (!res.confirm) return;
        try {
          domain.deleteSchedule(this.data.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(
            () => routes.back(routes.scheduleDay({ date: this.data.date })),
            400
          );
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '删除失败', icon: 'none' });
        }
      }
    });
  }
});
