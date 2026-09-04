const domain = require('../../domain/index');
const routes = require('../../config/routes');
const fabReveal = require('../../behaviors/fabReveal');
const {
  DISH_KIND,
  SCHEDULE_TYPES,
  SCHEDULE_LINKED_TYPES,
  SHOP_STATUS
} = require('../../utils/constants');
const {
  formatDateWeekday,
  buildDatePicker,
  ymdFromPicker,
  shiftDatePicker
} = require('../../utils/format');

const OFFSET_OPTIONS = [
  { id: 0, name: '准时' },
  { id: 900, name: '提前15分钟' },
  { id: 3600, name: '提前1小时' }
];

function toUnix(ymd, hm) {
  const p = String(ymd || '').split('-');
  const t = String(hm || '09:00').split(':');
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  const hh = Number(t[0]);
  const mm = Number(t[1]);
  if (!y || !m || !d) return 0;
  return Math.floor(new Date(y, m - 1, d, hh || 0, mm || 0, 0).getTime() / 1000);
}

function addPhoneCalendar({ title, date, time, offset, description }) {
  const startTime = toUnix(date, time);
  if (!startTime || !wx.addPhoneCalendar) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    wx.addPhoneCalendar({
      title: title || '日程',
      startTime,
      endTime: startTime + 3600,
      allDay: false,
      alarm: true,
      alarmOffset: Number(offset) || 0,
      description: description || '',
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}

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
    types: SCHEDULE_TYPES,
    remind: false,
    remindTime: '09:00',
    remindOffset: 0,
    offsetOptions: OFFSET_OPTIONS
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
      dateIndex: picker.index,
      remind: false
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

  onRemind(e) {
    this.setData({ remind: !!(e.detail && e.detail.value) });
  },

  onRemindTime(e) {
    this.setData({ remindTime: e.detail.value || '09:00' });
  },

  onRemindOffset(e) {
    this.setData({ remindOffset: Number(e.currentTarget.dataset.id) || 0 });
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

  dropScheduleIfEditing() {
    if (!this.data.id) return;
    try {
      domain.deleteSchedule(this.data.id);
    } catch (e) {
      // ignore
    }
  },

  jumpLinked(type, date) {
    const title = this.data.title || '';
    const note = this.data.note || '';
    // redirect：换掉「编辑日程」，业务页保存返回就回到当天列表
    if (type === 'watch') {
      routes.redirect(routes.moviePlanEdit({ date, title, from: 'schedule' }));
      return;
    }
    if (type === 'dine') {
      routes.redirect(
        routes.archiveList(DISH_KIND.DINE_OUT, { order: '1', date, from: 'schedule' })
      );
      return;
    }
    if (type === 'cook') {
      routes.redirect(
        routes.archiveList(DISH_KIND.HOMEMADE, { order: '1', date, from: 'schedule' })
      );
      return;
    }
    if (type === 'wish') {
      routes.redirect(routes.wishEdit({ title, note, from: 'schedule', date }));
      return;
    }
    if (type === 'note') {
      routes.redirect(routes.noteEdit({ date, title, body: note, from: 'schedule' }));
      return;
    }
    routes.back(routes.scheduleDay({ date }));
  },

  jumpAfterSave(type, date) {
    this.jumpLinked(type, date);
  },

  onSave() {
    const finish = (okCal, date, type, shop) => {
      let title = shop ? '已加入购物计划' : '已保存';
      if (this.data.remind) {
        title = okCal ? `${title}，已加入日历` : `${title}，日历未写入`;
      }
      wx.showToast({ title, icon: okCal || !this.data.remind ? 'success' : 'none' });
      setTimeout(() => {
        if (shop || !type || type === 'none') {
          routes.back(routes.scheduleDay({ date }));
          return;
        }
        this.jumpAfterSave(type, date);
      }, 400);
    };

    try {
      if (this.data.type === 'shop') {
        this.dropScheduleIfEditing();
        domain.saveShopLog({
          storeName: this.data.title,
          title: '',
          date: this.data.date,
          note: this.data.note,
          status: SHOP_STATUS.PLANNED
        });
        if (!this.data.remind) {
          finish(true, this.data.date, 'shop', true);
          return;
        }
        addPhoneCalendar({
          title: this.data.title || '购物计划',
          date: this.data.date,
          time: this.data.remindTime,
          offset: this.data.remindOffset,
          description: this.data.note
        }).then((ok) => finish(ok, this.data.date, 'shop', true));
        return;
      }
      if (SCHEDULE_LINKED_TYPES[this.data.type] && this.data.type !== 'shop') {
        this.dropScheduleIfEditing();
        const type = this.data.type;
        const date = this.data.date;
        const goLinked = (ok) => {
          let title = '去完善';
          if (this.data.remind) {
            title = ok ? '已加入日历' : '日历未写入';
          }
          wx.showToast({
            title,
            icon: ok || !this.data.remind ? 'success' : 'none'
          });
          setTimeout(() => this.jumpLinked(type, date), 400);
        };
        if (!this.data.remind) {
          goLinked(true);
          return;
        }
        addPhoneCalendar({
          title: this.data.title || '日程',
          date,
          time: this.data.remindTime,
          offset: this.data.remindOffset,
          description: this.data.note
        }).then(goLinked);
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
      if (!this.data.remind) {
        finish(true, row.date, row.type || 'none', false);
        return;
      }
      addPhoneCalendar({
        title: row.title,
        date: row.date,
        time: this.data.remindTime,
        offset: this.data.remindOffset,
        description: row.note
      }).then((ok) => finish(ok, row.date, row.type || 'none', false));
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
