/**
 * 影院档案：去过的影院 + 每个厅的最佳排与备注
 */
const cache = require('./cache');
const imageStore = require('../services/imageStore');
const { now, clone } = require('./helpers');
const { uuid } = require('../utils/id');
const { normalizeImages, pruneRemoved } = require('../utils/pickImages');
const syncHook = require('./syncHook');

function sortByName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), 'zh');
}

function enrichHall(row) {
  if (!row) return null;
  const bestRow = String(row.bestRow || '').trim();
  const images = row.images || [];
  return {
    ...clone(row),
    images,
    bestRowText: bestRow ? `最佳 ${bestRow} 排` : '未填最佳排',
    thumb: images[0] ? images[0].localPath : ''
  };
}

function enrichCinema(row, halls) {
  if (!row) return null;
  const hallList = (halls || []).map(enrichHall);
  const images = row.images || [];
  return {
    ...clone(row),
    images,
    halls: hallList,
    hallCount: hallList.length,
    hallSummary: hallList.length
      ? hallList
          .map((h) => (h.bestRow ? `${h.name} ${h.bestRow}排` : h.name))
          .join(' · ')
      : '还没有厅',
    thumb: images[0] ? images[0].localPath : ''
  };
}

function listCinemas() {
  const c = cache.ensure();
  const halls = (c.cinemaHalls || []).slice();
  return (c.cinemas || [])
    .slice()
    .sort(sortByName)
    .map((row) =>
      enrichCinema(
        row,
        halls.filter((h) => h.cinemaId === row.id).sort(sortByName)
      )
    );
}

function getCinema(id) {
  const c = cache.ensure();
  const row = (c.cinemas || []).find((x) => x.id === id) || null;
  if (!row) return null;
  const halls = (c.cinemaHalls || [])
    .filter((h) => h.cinemaId === id)
    .sort(sortByName);
  return enrichCinema(row, halls);
}

function saveCinema(input) {
  const name = String((input && input.name) || '').trim();
  if (!name) throw new Error('影院名称不能为空');
  const note = String((input && input.note) || '').trim();
  const images = normalizeImages(input && input.images);
  const c = cache.ensure();
  if (!Array.isArray(c.cinemas)) c.cinemas = [];
  const t = now();

  if (input && input.id) {
    const idx = c.cinemas.findIndex((x) => x.id === input.id);
    if (idx >= 0) {
      pruneRemoved(c.cinemas[idx].images, images);
      c.cinemas[idx] = {
        ...c.cinemas[idx],
        name,
        note,
        images,
        updatedAt: t
      };
      cache.persistCinemas();
      syncHook.afterSave('cinema', c.cinemas[idx]);
      return getCinema(c.cinemas[idx].id);
    }
    const row = {
      id: input.id,
      createdAt: t,
      updatedAt: t,
      source: 'local',
      name,
      note,
      images
    };
    c.cinemas.unshift(row);
    cache.persistCinemas();
    syncHook.afterSave('cinema', row);
    return getCinema(row.id);
  }

  const row = {
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    source: 'local',
    name,
    note,
    images
  };
  c.cinemas.unshift(row);
  cache.persistCinemas();
  syncHook.afterSave('cinema', row);
  return getCinema(row.id);
}

function removeCinema(id) {
  const c = cache.ensure();
  const cinema = (c.cinemas || []).find((x) => x.id === id);
  if (cinema) imageStore.removeDishImages(cinema.images);
  (c.cinemaHalls || []).forEach((h) => {
    if (h.cinemaId === id) imageStore.removeDishImages(h.images);
  });
  (c.moviePlans || []).forEach((p) => {
    if (p.cinemaId === id) {
      p.cinemaId = '';
      p.hallId = '';
      p.updatedAt = Date.now();
    }
  });
  const hallIds = (c.cinemaHalls || [])
    .filter((h) => h.cinemaId === id)
    .map((h) => h.id);
  const touchedPlans = (c.moviePlans || []).filter((p) => p.cinemaId === id);
  c.cinemas = (c.cinemas || []).filter((x) => x.id !== id);
  c.cinemaHalls = (c.cinemaHalls || []).filter((h) => h.cinemaId !== id);
  cache.persistCinemas();
  syncHook.afterRemove('cinema', id);
  hallIds.forEach((hid) => syncHook.afterRemove('cinemaHall', hid));
  touchedPlans.forEach((p) => syncHook.afterSave('moviePlan', p));
}

function listHalls(cinemaId) {
  const cinema = getCinema(cinemaId);
  return cinema ? cinema.halls : [];
}

function getHall(id) {
  const c = cache.ensure();
  const row = (c.cinemaHalls || []).find((h) => h.id === id) || null;
  return enrichHall(row);
}

function saveHall(input) {
  const cinemaId = String((input && input.cinemaId) || '').trim();
  if (!cinemaId) throw new Error('缺少影院');
  const cinema = (cache.ensure().cinemas || []).find((x) => x.id === cinemaId);
  if (!cinema) throw new Error('影院不存在');

  const name = String((input && input.name) || '').trim();
  if (!name) throw new Error('厅名不能为空');
  const bestRow = String((input && input.bestRow) || '').trim();
  const note = String((input && input.note) || '').trim();
  const images = normalizeImages(input && input.images);

  const c = cache.ensure();
  if (!Array.isArray(c.cinemaHalls)) c.cinemaHalls = [];
  const t = now();

  const dup = c.cinemaHalls.find(
    (h) =>
      h.cinemaId === cinemaId &&
      h.name === name &&
      (!input.id || h.id !== input.id)
  );
  if (dup) throw new Error('该影院已有同名厅');

  if (input && input.id) {
    const idx = c.cinemaHalls.findIndex((h) => h.id === input.id);
    if (idx >= 0) {
      pruneRemoved(c.cinemaHalls[idx].images, images);
      c.cinemaHalls[idx] = {
        ...c.cinemaHalls[idx],
        cinemaId,
        name,
        bestRow,
        note,
        images,
        updatedAt: t
      };
      cache.persistCinemas();
      syncHook.afterSave('cinemaHall', c.cinemaHalls[idx]);
      return enrichHall(c.cinemaHalls[idx]);
    }
    const row = {
      id: input.id,
      createdAt: t,
      updatedAt: t,
      source: 'local',
      cinemaId,
      name,
      bestRow,
      note,
      images
    };
    c.cinemaHalls.unshift(row);
    cache.persistCinemas();
    syncHook.afterSave('cinemaHall', row);
    return enrichHall(row);
  }

  const row = {
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    source: 'local',
    cinemaId,
    name,
    bestRow,
    note,
    images
  };
  c.cinemaHalls.unshift(row);
  cache.persistCinemas();
  syncHook.afterSave('cinemaHall', row);
  return enrichHall(row);
}

function removeHall(id) {
  const c = cache.ensure();
  const hall = (c.cinemaHalls || []).find((h) => h.id === id);
  if (hall) imageStore.removeDishImages(hall.images);
  (c.moviePlans || []).forEach((p) => {
    if (p.hallId === id) {
      p.hallId = '';
      p.updatedAt = Date.now();
    }
  });
  const touchedPlans = (c.moviePlans || []).filter((p) => p.hallId === id);
  c.cinemaHalls = (c.cinemaHalls || []).filter((h) => h.id !== id);
  cache.persistCinemas();
  syncHook.afterRemove('cinemaHall', id);
  touchedPlans.forEach((p) => syncHook.afterSave('moviePlan', p));
}

module.exports = {
  listCinemas,
  getCinema,
  saveCinema,
  removeCinema,
  listHalls,
  getHall,
  saveHall,
  removeHall
};
