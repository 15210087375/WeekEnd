function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatDateWeekday(ymd) {
  const raw = String(ymd || '').trim();
  if (!raw) return '';
  const parts = raw.split('-');
  if (parts.length < 3) return raw;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return raw;
  return `${raw} ${WEEKDAYS[d.getDay()]}`;
}

function parseYmd(ymd) {
  const now = new Date();
  const fallback = {
    y: now.getFullYear(),
    m: now.getMonth() + 1,
    d: now.getDate()
  };
  const raw = String(ymd || '').trim();
  const parts = raw.split('-');
  if (parts.length < 3) return fallback;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return fallback;
  return { y, m, d };
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

function weekdayOf(y, m, d) {
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

/**
 * 年/月/日/周几 四列选择器
 */
function buildDatePicker(ymd) {
  const now = new Date();
  const cy = now.getFullYear();
  const years = [];
  for (let i = cy - 3; i <= cy + 3; i++) years.push(`${i}年`);
  const months = [];
  for (let i = 1; i <= 12; i++) months.push(`${pad2(i)}月`);

  const cur = parseYmd(ymd);
  const dim = daysInMonth(cur.y, cur.m);
  const day = Math.min(cur.d, dim);
  const days = [];
  for (let i = 1; i <= dim; i++) days.push(`${pad2(i)}日`);

  const yi = years.indexOf(`${cur.y}年`);
  return {
    range: [years, months, days, [weekdayOf(cur.y, cur.m, day)]],
    index: [yi < 0 ? 3 : yi, cur.m - 1, day - 1, 0]
  };
}

function ymdFromPicker(range, index) {
  const y = parseInt((range[0][index[0]] || '').replace('年', ''), 10);
  const m = parseInt((range[1][index[1]] || '').replace('月', ''), 10);
  const d = parseInt((range[2][index[2]] || '').replace('日', ''), 10);
  if (!y || !m || !d) return '';
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function shiftDatePicker(range, index, col) {
  const y = parseInt((range[0][index[0]] || '').replace('年', ''), 10);
  const m = parseInt((range[1][index[1]] || '').replace('月', ''), 10);
  let d = parseInt((range[2][index[2]] || '').replace('日', ''), 10);
  const dim = daysInMonth(y, m);
  if (col === 0 || col === 1) {
    const days = [];
    for (let i = 1; i <= dim; i++) days.push(`${pad2(i)}日`);
    range[2] = days;
    if (d > dim) d = dim;
    index[2] = d - 1;
  }
  d = Math.min(d || 1, dim);
  range[3] = [weekdayOf(y, m, d)];
  index[3] = 0;
  return { range, index };
}

module.exports = {
  formatDateTime,
  formatDateWeekday,
  buildDatePicker,
  ymdFromPicker,
  shiftDatePicker,
  pad2
};
