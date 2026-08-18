/**
 * 观影记录：看过的场次（票、消费、感想），可从计划跳转生成
 */
const cache = require('./cache');
const imageStore = require('../services/imageStore');
const { now, clone } = require('./helpers');
const { uuid } = require('../utils/id');
const { normalizeImages, pruneRemoved } = require('../utils/pickImages');
const syncHook = require('./syncHook');
const { parseScore10 } = require('../utils/score');

function parseCost(raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function parseScore(raw) {
  return parseScore10(raw, true);
}

function placeText(cinemaId, hallId) {
  const c = cache.ensure();
  const cinema = cinemaId
    ? (c.cinemas || []).find((x) => x.id === cinemaId)
    : null;
  const hall = hallId
    ? (c.cinemaHalls || []).find((x) => x.id === hallId)
    : null;
  const parts = [];
  if (cinema && cinema.name) parts.push(cinema.name);
  if (hall && hall.name) parts.push(hall.name);
  return parts.join(' · ');
}

function enrich(row) {
  if (!row) return null;
  const images = row.images || [];
  const cost = row.cost;
  return {
    ...clone(row),
    images,
    placeText: placeText(row.cinemaId, row.hallId),
    costText: cost != null ? `¥${cost}` : '',
    scoreText: row.score != null ? `${row.score} 分` : '',
    thumb: images[0] ? images[0].localPath : ''
  };
}

function list() {
  return (cache.ensure().movieLogs || [])
    .slice()
    .sort((a, b) => {
      const da = String(b.date || '');
      const db = String(a.date || '');
      if (da !== db) return da.localeCompare(db);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    })
    .map(enrich);
}

function get(id) {
  const row = (cache.ensure().movieLogs || []).find((r) => r.id === id) || null;
  return enrich(row);
}

function getByPlanId(planId) {
  if (!planId) return null;
  const row =
    (cache.ensure().movieLogs || []).find((r) => r.planId === planId) || null;
  return enrich(row);
}

function save(input) {
  const title = String((input && input.title) || '').trim();
  if (!title) throw new Error('片名不能为空');
  const feeling = String((input && input.feeling) || '').trim();
  const note = String((input && input.note) || '').trim();
  const date = String((input && input.date) || '').trim();
  const planId = String((input && input.planId) || '').trim();
  const cinemaId = String((input && input.cinemaId) || '').trim();
  const hallId = String((input && input.hallId) || '').trim();
  const images = normalizeImages(input && input.images);
  const cost = parseCost(input && input.cost);
  const score = parseScore(input && input.score);

  const c = cache.ensure();
  if (!Array.isArray(c.movieLogs)) c.movieLogs = [];
  const t = now();
  const payload = {
    title,
    feeling,
    note,
    date,
    planId,
    cinemaId,
    hallId,
    images,
    cost,
    score
  };

  if (input && input.id) {
    const idx = c.movieLogs.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      pruneRemoved(c.movieLogs[idx].images, images);
      c.movieLogs[idx] = {
        ...c.movieLogs[idx],
        ...payload,
        updatedAt: t
      };
      cache.persistCinemas();
      syncHook.afterSave('movieLog', c.movieLogs[idx]);
      return enrich(c.movieLogs[idx]);
    }
    const row = {
      id: input.id,
      createdAt: t,
      updatedAt: t,
      source: 'local',
      ...payload
    };
    c.movieLogs.unshift(row);
    cache.persistCinemas();
    syncHook.afterSave('movieLog', row);
    return enrich(row);
  }

  const row = {
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    source: 'local',
    ...payload
  };
  c.movieLogs.unshift(row);
  cache.persistCinemas();
  syncHook.afterSave('movieLog', row);
  return enrich(row);
}

function remove(id) {
  const c = cache.ensure();
  const row = (c.movieLogs || []).find((r) => r.id === id);
  if (row) imageStore.removeDishImages(row.images);
  c.movieLogs = (c.movieLogs || []).filter((r) => r.id !== id);
  cache.persistCinemas();
  syncHook.afterRemove('movieLog', id);
}

module.exports = {
  list,
  get,
  getByPlanId,
  save,
  remove,
  enrich
};
