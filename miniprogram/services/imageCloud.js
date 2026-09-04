/**
 * 家庭空间封面图：只上传第 1 张压缩图（最长边 800 / 质量 70）。
 * 私密记录不上云；失败不阻断保存。
 */
const imageStore = require('./imageStore');
const cloud = require('./cloud');

const inflight = {};

function spaceMod() {
  return require('../domain/space');
}

function cacheMod() {
  return require('../domain/cache');
}

function policyMod() {
  return require('../domain/syncPolicy');
}

function persistOf(type) {
  const cache = cacheMod();
  const map = {
    wish: cache.persistWishes,
    shopLog: cache.persistShopLogs,
    note: cache.persistNotes,
    dish: cache.persistDishes,
    cinema: cache.persistCinemas,
    cinemaHall: cache.persistCinemas,
    moviePlan: cache.persistCinemas,
    movieLog: cache.persistCinemas,
    schedule: cache.persistSchedules
  };
  return map[type];
}

function canUseCloud() {
  try {
    cloud.init();
    return spaceMod().isInSpace() && cloud.isReady();
  } catch (e) {
    return false;
  }
}

function fileNameOf(path) {
  const s = String(path || '').replace(/\\/g, '/');
  const i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}

function compressCover(src) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src,
      quality: 70,
      compressedWidth: 800,
      success: (res) => resolve(res.tempFilePath),
      fail: () => {
        wx.compressImage({
          src,
          quality: 70,
          success: (r) => resolve(r.tempFilePath),
          fail: reject
        });
      }
    });
  });
}

function uploadCover(spaceId, type, entityId, filePath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath: `wfa/${spaceId}/${type}/${entityId}/cover.jpg`,
      filePath,
      success: (res) => resolve(res.fileID),
      fail: reject
    });
  });
}

function deleteFile(fileId) {
  const id = String(fileId || '').trim();
  if (!id || !/^cloud:\/\//.test(id)) return Promise.resolve();
  if (!canUseCloud()) return Promise.resolve();
  return new Promise((resolve) => {
    wx.cloud.deleteFile({
      fileList: [id],
      complete: () => resolve()
    });
  });
}

function deleteFileIds(images) {
  (images || []).forEach((img) => {
    if (img && img.fileId) deleteFile(img.fileId);
  });
}

function imagesForPush(record) {
  if (!record || record.visibility === 'private') return [];
  const first = (record.images || []).find((img) => img && img.fileId);
  if (!first) return [];
  return [
    {
      localPath: '',
      fileId: first.fileId,
      coverOf: first.coverOf || undefined
    }
  ];
}

function mergeImages(localImgs, remoteImgs) {
  const local = Array.isArray(localImgs) ? localImgs : [];
  const remote = Array.isArray(remoteImgs) ? remoteImgs : [];
  if (!local.length) {
    return remote
      .filter((img) => img && (img.fileId || img.localPath))
      .map((img) => ({
        localPath: img.localPath || '',
        fileId: img.fileId || undefined,
        coverOf: img.coverOf || undefined,
        remoteUrl: img.remoteUrl || undefined
      }));
  }
  if (!remote.length) return local;
  const cover = remote.find((img) => img && img.fileId) || remote[0];
  return local.map((img, i) => {
    if (i !== 0 || !cover || !cover.fileId) return img;
    if (img.fileId === cover.fileId) return img;
    return {
      ...img,
      fileId: img.fileId || cover.fileId,
      coverOf: img.coverOf || cover.coverOf
    };
  });
}

function patchCover(type, entityId, fileId, coverOf, oldFileId) {
  const cache = cacheMod();
  const key = policyMod().listKey(type);
  if (!key) return null;
  const list = cache.ensure()[key];
  if (!Array.isArray(list)) return null;
  const idx = list.findIndex((row) => row && row.id === entityId);
  if (idx < 0) return null;
  const row = list[idx];
  const images = (row.images || []).slice();
  if (!images.length) {
    images.push({ localPath: '', fileId, coverOf });
  } else {
    images[0] = { ...images[0], fileId, coverOf };
  }
  list[idx] = { ...row, images };
  const persist = persistOf(type);
  if (persist) persist();
  if (oldFileId && oldFileId !== fileId) deleteFile(oldFileId);
  return list[idx];
}

function stripPrivateCover(type, record) {
  const first = record.images && record.images[0];
  if (!first || !first.fileId) return Promise.resolve();
  const old = first.fileId;
  const patched = patchCover(type, record.id, '', '', old);
  deleteFile(old);
  if (patched) {
    try {
      require('../domain/sync').scheduleUpsert(type, patched, false);
    } catch (e) {
      // ignore
    }
  }
  return Promise.resolve();
}

function syncCover(type, record) {
  try {
    if (!policyMod().keepImages(type)) return Promise.resolve();
    if (!record || !record.id) return Promise.resolve();
    const key = `${type}:${record.id}`;
    if (inflight[key]) return inflight[key];

    const run = Promise.resolve()
      .then(() => {
        if (!canUseCloud()) return;
        if (record.visibility === 'private') return stripPrivateCover(type, record);

        const first = (record.images || [])[0];
        if (!first || !first.localPath) return;

        const coverOf = fileNameOf(first.localPath);
        if (first.fileId && first.coverOf === coverOf) return;

        const local = imageStore.resolveLocalPath(first.localPath);
        if (!imageStore.exists(local)) return;

        const spaceId = spaceMod().getSession().spaceId;
        const oldFileId = first.fileId || '';
        return compressCover(local)
          .then((tmp) => uploadCover(spaceId, type, record.id, tmp))
          .then((fileId) => {
            if (!fileId) return;
            const patched = patchCover(type, record.id, fileId, coverOf, oldFileId);
            if (patched) {
              require('../domain/sync').scheduleUpsert(type, patched, false);
            }
          });
      })
      .catch((err) => {
        console.warn('[imageCloud] syncCover', type, record.id, err);
      })
      .then(() => {
        delete inflight[key];
      });

    inflight[key] = run;
    return run;
  } catch (e) {
    console.warn('[imageCloud] syncCover', e);
    return Promise.resolve();
  }
}

module.exports = {
  syncCover,
  deleteFile,
  deleteFileIds,
  imagesForPush,
  mergeImages
};
