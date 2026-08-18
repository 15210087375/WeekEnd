/**
 * 观影计划：想看/已约/看过（与影院同属观影模块）
 */
const cache = require('./cache');
const imageStore = require('../services/imageStore');
const { now, clone } = require('./helpers');
const { uuid } = require('../utils/id');
const { normalizeImages, pruneRemoved } = require('../utils/pickImages');
const syncHook = require('./syncHook');
const {
  MOVIE_PLAN_STATUS,
  MOVIE_PLAN_STATUS_LABELS,
  MOVIE_PLAN_STATUS_ORDER
} = require('../utils/constants');

const VALID = {
  [MOVIE_PLAN_STATUS.WANT]: true,
  [MOVIE_PLAN_STATUS.PLANNED]: true,
  [MOVIE_PLAN_STATUS.WATCHED]: true,
  [MOVIE_PLAN_STATUS.DROP]: true
};

function normalizeStatus(raw) {
  const s = String(raw || '').trim();
  return VALID[s] ? s : MOVIE_PLAN_STATUS.WANT;
}

function enrich(row) {
  if (!row) return null;
  const images = row.images || [];
  const cinema = row.cinemaId
    ? (cache.ensure().cinemas || []).find((c) => c.id === row.cinemaId)
    : null;
  const hall = row.hallId
    ? (cache.ensure().cinemaHalls || []).find((h) => h.id === row.hallId)
    : null;
  const placeParts = [];
  if (cinema && cinema.name) placeParts.push(cinema.name);
  if (hall && hall.name) placeParts.push(hall.name);
  return {
    ...clone(row),
    statusLabel: MOVIE_PLAN_STATUS_LABELS[row.status] || row.status,
    cinemaName: cinema ? cinema.name : '',
    hallName: hall ? hall.name : '',
    placeText: placeParts.join(' · '),
    thumb: images[0] ? images[0].localPath : '',
    linkedLogId:
      ((cache.ensure().movieLogs || []).find((l) => l.planId === row.id) || {})
        .id || ''
  };
}

function list(filter) {
  const statusFilter =
    filter && filter.status ? normalizeStatus(filter.status) : '';
  let rows = (cache.ensure().moviePlans || []).slice();
  if (filter && filter.status) {
    rows = rows.filter((r) => r.status === statusFilter);
  }
  rows.sort((a, b) => {
    const oa =
      MOVIE_PLAN_STATUS_ORDER[a.status] != null
        ? MOVIE_PLAN_STATUS_ORDER[a.status]
        : 9;
    const ob =
      MOVIE_PLAN_STATUS_ORDER[b.status] != null
        ? MOVIE_PLAN_STATUS_ORDER[b.status]
        : 9;
    if (oa !== ob) return oa - ob;
    const da = String(b.date || '');
    const db = String(a.date || '');
    if (da !== db) return da.localeCompare(db);
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  return rows.map(enrich);
}

function get(id) {
  const row = (cache.ensure().moviePlans || []).find((r) => r.id === id) || null;
  return enrich(row);
}

function save(input) {
  const title = String((input && input.title) || '').trim();
  if (!title) throw new Error('片名不能为空');
  const note = String((input && input.note) || '').trim();
  const date = String((input && input.date) || '').trim();
  const status = normalizeStatus(input && input.status);
  const cinemaId = String((input && input.cinemaId) || '').trim();
  const hallId = String((input && input.hallId) || '').trim();
  const images = normalizeImages(input && input.images);

  const c = cache.ensure();
  if (!Array.isArray(c.moviePlans)) c.moviePlans = [];
  const t = now();

  const payload = {
    title,
    note,
    date,
    status,
    cinemaId,
    hallId,
    images
  };

  if (input && input.id) {
    const idx = c.moviePlans.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      pruneRemoved(c.moviePlans[idx].images, images);
      c.moviePlans[idx] = {
        ...c.moviePlans[idx],
        ...payload,
        updatedAt: t
      };
      cache.persistCinemas();
      syncHook.afterSave('moviePlan', c.moviePlans[idx]);
      return enrich(c.moviePlans[idx]);
    }
    const row = {
      id: input.id,
      createdAt: t,
      updatedAt: t,
      source: 'local',
      ...payload
    };
    c.moviePlans.unshift(row);
    cache.persistCinemas();
    syncHook.afterSave('moviePlan', row);
    return enrich(row);
  }

  const row = {
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    source: 'local',
    ...payload
  };
  c.moviePlans.unshift(row);
  cache.persistCinemas();
  syncHook.afterSave('moviePlan', row);
  return enrich(row);
}

function remove(id) {
  const c = cache.ensure();
  const row = (c.moviePlans || []).find((r) => r.id === id);
  if (row) imageStore.removeDishImages(row.images);
  const touchedLogs = [];
  (c.movieLogs || []).forEach((log) => {
    if (log.planId === id) {
      log.planId = '';
      log.updatedAt = Date.now();
      touchedLogs.push(log);
    }
  });
  c.moviePlans = (c.moviePlans || []).filter((r) => r.id !== id);
  cache.persistCinemas();
  syncHook.afterRemove('moviePlan', id);
  touchedLogs.forEach((log) => syncHook.afterSave('movieLog', log));
}

module.exports = {
  list,
  get,
  save,
  remove,
  enrich,
  normalizeStatus
};
