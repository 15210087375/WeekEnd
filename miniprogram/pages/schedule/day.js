const domain = require('../../domain/index');
const routes = require('../../config/routes');
const { formatDateWeekday, pad2 } = require('../../utils/format');
const {
  DISH_KIND,
  ORDER_STATUS,
  MOVIE_PLAN_STATUS,
  SCHEDULE_LINKED_TYPES
} = require('../../utils/constants');

function parseYmd(ymd) {
  const raw = String(ymd || '').slice(0, 10);
  const p = raw.split('-');
  if (p.length < 3) return new Date();
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function toYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function shiftYmd(ymd, days) {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

function mondayOf(ymd) {
  const d = parseYmd(ymd);
  const day = d.getDay();
  const back = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - back);
  return toYmd(d);
}

function collectBusy() {
  const busy = {};
  function mark(raw) {
    const d = String(raw || '').slice(0, 10);
    if (d) busy[d] = true;
  }
  (domain.listSchedules() || []).forEach((row) => {
    if (SCHEDULE_LINKED_TYPES[row.type]) return;
    mark(row.date);
  });
  (domain.listShopLogs() || []).forEach((row) => mark(row.date));
  (domain.listMoviePlans() || []).forEach((row) => {
    if (row.status === MOVIE_PLAN_STATUS.DROP) return;
    mark(row.date);
  });
  (domain.listOrders({ includeEmptyOpen: true }) || []).forEach((row) => {
    if (row.status === ORDER_STATUS.ABANDONED) return;
    mark(row.mealDate);
  });
  (domain.listNotes() || []).forEach((row) => mark(row.date));
  return busy;
}

function buildWeek(center, busy) {
  const today = domain.scheduleToday();
  const monday = mondayOf(center);
  const labels = ['一', '二', '三', '四', '五', '六', '日'];
  return labels.map((week, i) => {
    const date = shiftYmd(monday, i);
    const d = parseYmd(date);
    return {
      date,
      day: d.getDate(),
      week,
      today: date === today,
      on: date === center,
      has: !!busy[date]
    };
  });
}

function buildMonth(center, busy) {
  const today = domain.scheduleToday();
  const cur = parseYmd(center);
  const month = cur.getMonth();
  const first = new Date(cur.getFullYear(), month, 1);
  const start = mondayOf(toYmd(first));
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = shiftYmd(start, w * 7 + i);
      const d = parseYmd(date);
      days.push({
        date,
        day: d.getDate(),
        today: date === today,
        on: date === center,
        has: !!busy[date],
        out: d.getMonth() !== month
      });
    }
    weeks.push({ key: `w${w}`, days });
  }
  return weeks;
}

function shiftMonth(ymd, delta) {
  const d = parseYmd(ymd);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, dim));
  return toYmd(d);
}

Page({
  data: {
    date: '',
    dateText: '',
    monthMode: true,
    week: [],
    monthWeeks: [],
    weekdayHeads: ['一', '二', '三', '四', '五', '六', '日'],
    list: [],
    empty: true
  },

  onLoad(query) {
    const date = (query && query.date) || domain.scheduleToday();
    this.setData({ date: String(date).slice(0, 10) });
  },

  onShow() {
    this.reload();
  },

  reload() {
    const date = this.data.date || domain.scheduleToday();
    const list = [];

    domain.listSchedules({ date }).forEach((row) => {
      if (SCHEDULE_LINKED_TYPES[row.type]) return;
      list.push({
        key: `s-${row.id}`,
        source: 'schedule',
        sourceId: row.id,
        typeLabel: row.typeLabel === '无' ? '日程' : row.typeLabel,
        title: row.title,
        note: row.note || ''
      });
    });

    (domain.listShopLogs({ date }) || []).forEach((row) => {
      list.push({
        key: `p-${row.id}`,
        source: 'shop',
        sourceId: row.id,
        typeLabel: row.status === 'planned' ? '购物计划' : '购物',
        title: row.displayTitle,
        note: row.status === 'planned' ? row.note || '' : row.amountText || row.note || ''
      });
    });

    (domain.listMoviePlans() || []).forEach((row) => {
      if (String(row.date || '').slice(0, 10) !== date) return;
      if (row.status === MOVIE_PLAN_STATUS.DROP) return;
      list.push({
        key: `w-${row.id}`,
        source: 'watch',
        sourceId: row.id,
        typeLabel: '观影',
        title: row.title,
        note: row.placeText || row.statusLabel || ''
      });
    });

    (domain.listOrders({ includeEmptyOpen: true }) || []).forEach((row) => {
      if (String(row.mealDate || '').slice(0, 10) !== date) return;
      if (row.status === ORDER_STATUS.ABANDONED) return;
      list.push({
        key: `o-${row.id}`,
        source: 'order',
        sourceId: row.id,
        typeLabel: '点餐',
        title: row.title || '点餐',
        note: `${row.scheduleText || ''} · ${row.itemCount || 0} 道`
      });
    });

    (domain.listNotes() || []).forEach((row) => {
      if (String(row.date || '').slice(0, 10) !== date) return;
      list.push({
        key: `n-${row.id}`,
        source: 'note',
        sourceId: row.id,
        typeLabel: '随笔',
        title: row.displayTitle || row.title || '随笔',
        note: row.body || ''
      });
    });

    const busy = collectBusy();
    this.setData({
      date,
      dateText: formatDateWeekday(date),
      week: buildWeek(date, busy),
      monthWeeks: buildMonth(date, busy),
      list,
      empty: !list.length
    });
  },

  onPickDay(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    this.setData({ date }, () => this.reload());
  },

  onPrev() {
    const next = this.data.monthMode
      ? shiftMonth(this.data.date, -1)
      : shiftYmd(this.data.date, -7);
    this.setData({ date: next }, () => this.reload());
  },

  onNext() {
    const next = this.data.monthMode
      ? shiftMonth(this.data.date, 1)
      : shiftYmd(this.data.date, 7);
    this.setData({ date: next }, () => this.reload());
  },

  onToggleMonth() {
    this.setData({ monthMode: !this.data.monthMode });
  },

  onOpen(e) {
    const source = e.currentTarget.dataset.source;
    const id = e.currentTarget.dataset.id;
    if (source === 'schedule') {
      routes.go(routes.scheduleEdit({ id, date: this.data.date }));
      return;
    }
    if (source === 'watch') {
      routes.go(routes.moviePlanEdit({ id }));
      return;
    }
    if (source === 'order') {
      routes.go(routes.orderDetail(id));
      return;
    }
    if (source === 'shop') {
      routes.go(routes.shopEdit({ id }));
      return;
    }
    if (source === 'note') {
      routes.go(routes.noteEdit({ id }));
    }
  },

  goCreate() {
    routes.go(routes.scheduleEdit({ date: this.data.date }));
  }
});
