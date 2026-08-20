/**
 * 日程：某一天想做的事（可无类型，或跳到观影/点餐/心愿）
 */
const cache = require('./cache');
const { now, clone } = require('./helpers');
const { uuid } = require('../utils/id');
const { SCHEDULE_TYPES } = require('../utils/constants');
const syncHook = require('./syncHook');

const TYPE_OK = {};
SCHEDULE_TYPES.forEach((t) => {
  TYPE_OK[t.id] = t.name;
});

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function normalizeType(raw) {
  const id = String(raw || '').trim();
  return TYPE_OK[id] ? id : 'none';
}

function typeLabel(raw) {
  return TYPE_OK[normalizeType(raw)] || '无';
}

function enrich(row) {
  if (!row) return null;
  return {
    ...clone(row),
    type: normalizeType(row.type),
    typeLabel: typeLabel(row.type)
  };
}

function list(filter) {
  let rows = (cache.ensure().schedules || []).slice();
  const date = filter && filter.date ? String(filter.date).slice(0, 10) : '';
  if (date) rows = rows.filter((r) => String(r.date || '').slice(0, 10) === date);
  rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return rows.map(enrich);
}

function get(id) {
  const row = (cache.ensure().schedules || []).find((r) => r.id === id) || null;
  return enrich(row);
}

function save(input) {
  const title = String((input && input.title) || '').trim();
  if (!title) throw new Error('请填写想做什么');
  const date = String((input && input.date) || '').trim() || todayYmd();
  const type = normalizeType(input && input.type);
  const note = String((input && input.note) || '').trim();
  const visibility = input && input.visibility === 'private' ? 'private' : 'space';

  const c = cache.ensure();
  if (!Array.isArray(c.schedules)) c.schedules = [];
  const t = now();

  let createdBy = '';
  let createdByMemberNo = 0;
  try {
    const space = require('./space');
    const who = space.actor();
    createdBy = who.userId || '';
    createdByMemberNo = who.memberNo || 0;
  } catch (e) {
    createdBy = '';
  }

  const payload = { title, date, type, note, visibility };

  if (input && input.id) {
    const idx = c.schedules.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      c.schedules[idx] = {
        ...c.schedules[idx],
        ...payload,
        createdBy: c.schedules[idx].createdBy || createdBy,
        createdByMemberNo: c.schedules[idx].createdByMemberNo || createdByMemberNo,
        updatedAt: t
      };
      cache.persistSchedules();
      syncHook.afterSave('schedule', c.schedules[idx]);
      return enrich(c.schedules[idx]);
    }
    const row = {
      id: input.id,
      createdAt: t,
      updatedAt: t,
      source: 'local',
      createdBy,
      createdByMemberNo,
      ...payload
    };
    c.schedules.unshift(row);
    cache.persistSchedules();
    syncHook.afterSave('schedule', row);
    return enrich(row);
  }

  const row = {
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    source: 'local',
    createdBy,
    createdByMemberNo,
    ...payload
  };
  c.schedules.unshift(row);
  cache.persistSchedules();
  syncHook.afterSave('schedule', row);
  return enrich(row);
}

function remove(id) {
  const c = cache.ensure();
  c.schedules = (c.schedules || []).filter((r) => r.id !== id);
  cache.persistSchedules();
  syncHook.afterRemove('schedule', id);
}

module.exports = {
  list,
  get,
  save,
  remove,
  enrich,
  todayYmd,
  typeLabel,
  normalizeType
};
