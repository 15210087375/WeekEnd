/**
 * 随笔：随手记，默认仅本人
 */
const cache = require('./cache');
const { now, clone } = require('./helpers');
const { uuid } = require('../utils/id');
const { normalizeImages, pruneRemoved } = require('../utils/pickImages');
const { NOTE_TAGS } = require('../utils/constants');
const syncHook = require('./syncHook');

const TAG_BY_ID = {};
const TAG_BY_NAME = {};
NOTE_TAGS.forEach((t) => {
  TAG_BY_ID[t.id] = t.name;
  TAG_BY_NAME[t.name] = t.id;
});

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKeyOf(ymd) {
  return String(ymd || '').slice(0, 7);
}

function thisMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function lastMonthKey() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function normalizeTag(raw) {
  const key = String(raw || '').trim();
  if (!key) return '';
  if (TAG_BY_ID[key]) return key;
  if (TAG_BY_NAME[key]) return TAG_BY_NAME[key];
  return key;
}

function tagLabel(raw) {
  const id = normalizeTag(raw);
  if (!id) return '';
  if (TAG_BY_ID[id]) return TAG_BY_ID[id];
  if (/^[a-z0-9_]+$/i.test(id)) return '';
  return id;
}

function snippet(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '无标题';
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function displayTitleOf(title, body) {
  const t = String(title || '').trim();
  if (t) return t;
  return snippet(body, 16);
}

function enrich(row) {
  if (!row) return null;
  const title = String(row.title || '').trim();
  const body = String(row.body || '');
  return {
    ...clone(row),
    title,
    body,
    displayTitle: displayTitleOf(title, body),
    tag: normalizeTag(row.tag),
    tagLabel: tagLabel(row.tag),
    visibility: row.visibility === 'space' ? 'space' : 'private'
  };
}

function filterPrivate(rows) {
  try {
    const space = require('./space');
    const sess = space.getSession() || {};
    const uid = sess.userId || '';
    return rows.filter((w) => {
      if (w.visibility !== 'private') return true;
      if (!w.createdBy) return true;
      return !uid || w.createdBy === uid;
    });
  } catch (e) {
    return rows;
  }
}

/**
 * @param {{ tag?: string, month?: 'this'|'last'|string }} [filter]
 */
function list(filter) {
  let rows = (cache.ensure().notes || []).slice();
  rows = filterPrivate(rows);
  const tag = filter && filter.tag ? normalizeTag(filter.tag) : '';
  if (tag) rows = rows.filter((r) => normalizeTag(r.tag) === tag);
  let month = filter && filter.month ? String(filter.month) : '';
  if (month === 'this') month = thisMonthKey();
  if (month === 'last') month = lastMonthKey();
  if (month) rows = rows.filter((r) => monthKeyOf(r.date) === month);
  rows.sort((a, b) => {
    const da = String(b.date || '');
    const db = String(a.date || '');
    if (da !== db) return da.localeCompare(db);
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  return rows.map(enrich);
}

function get(id) {
  const row = (cache.ensure().notes || []).find((r) => r.id === id) || null;
  return enrich(row);
}

function save(input) {
  const title = String((input && input.title) || '').trim();
  const body = String((input && input.body) || '').trim();
  if (!body) throw new Error('请写点内容');
  const date = String((input && input.date) || '').trim() || todayYmd();
  const tag = normalizeTag(input && input.tag);
  const images = normalizeImages(input && input.images);
  const visibility = input && input.visibility === 'space' ? 'space' : 'private';

  const c = cache.ensure();
  if (!Array.isArray(c.notes)) c.notes = [];
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

  const payload = {
    title,
    body,
    date,
    tag,
    images,
    visibility
  };

  if (input && input.id) {
    const idx = c.notes.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      pruneRemoved(c.notes[idx].images, images);
      c.notes[idx] = {
        ...c.notes[idx],
        ...payload,
        createdBy: c.notes[idx].createdBy || createdBy,
        createdByMemberNo: c.notes[idx].createdByMemberNo || createdByMemberNo,
        updatedAt: t
      };
      cache.persistNotes();
      syncHook.afterSave('note', c.notes[idx]);
      return enrich(c.notes[idx]);
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
    c.notes.unshift(row);
    cache.persistNotes();
    syncHook.afterSave('note', row);
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
  c.notes.unshift(row);
  cache.persistNotes();
  syncHook.afterSave('note', row);
  return enrich(row);
}

function remove(id) {
  const imageStore = require('../services/imageStore');
  const c = cache.ensure();
  const row = (c.notes || []).find((r) => r.id === id);
  if (row) imageStore.removeDishImages(row.images);
  c.notes = (c.notes || []).filter((r) => r.id !== id);
  cache.persistNotes();
  syncHook.afterRemove('note', id);
}

module.exports = {
  list,
  get,
  save,
  remove,
  enrich,
  todayYmd,
  displayTitleOf,
  tagLabel
};
