/**
 * 本地截图/相册导入（不写业务表）
 */
const imageStore = require('../services/imageStore');

const MAX_IMAGES = 6;

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => {
      if (!img) return null;
      const localPath = img.localPath ? String(img.localPath) : '';
      const fileId = img.fileId || img.fileID || '';
      if (!localPath && !fileId) return null;
      return {
        localPath,
        remoteUrl: img.remoteUrl || undefined,
        fileId: fileId || undefined,
        coverOf: img.coverOf || undefined
      };
    })
    .filter(Boolean);
}

function pruneRemoved(prevImages, nextImages) {
  const next = normalizeImages(nextImages);
  const nextPaths = new Set(next.map((i) => i.localPath).filter(Boolean));
  const nextIds = new Set(next.map((i) => i.fileId).filter(Boolean));
  (prevImages || []).forEach((img) => {
    if (!img) return;
    const keptPath = img.localPath && nextPaths.has(img.localPath);
    const keptId = img.fileId && nextIds.has(img.fileId);
    if (keptPath || keptId) return;
    if (img.localPath) imageStore.removeFileQuiet(img.localPath);
    if (img.fileId) {
      try {
        require('../services/imageCloud').deleteFile(img.fileId);
      } catch (e) {
        // ignore
      }
    }
  });
}

function chooseScreenshots({ images, ownerId, max, onDone }) {
  const cap = max || MAX_IMAGES;
  const current = images || [];
  const remain = cap - current.length;
  if (remain <= 0) {
    wx.showToast({ title: `最多 ${cap} 张`, icon: 'none' });
    return;
  }
  wx.chooseMedia({
    count: remain,
    mediaType: ['image'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const added = [];
      (res.tempFiles || []).forEach((f) => {
        if (!f || !f.tempFilePath) return;
        try {
          added.push({ localPath: imageStore.persistImage(f.tempFilePath, ownerId) });
        } catch (err) {
          console.warn('[pickImages] persist failed', err);
        }
      });
      if (!added.length) {
        wx.showToast({ title: '导入截图失败', icon: 'none' });
        return;
      }
      if (typeof onDone === 'function') onDone(current.concat(added));
    }
  });
}

function previewImages(images, index) {
  const urls = (images || []).map((i) => imageStore.displaySrc(i)).filter(Boolean);
  if (!urls.length) {
    wx.showToast({ title: '没有可预览的图片', icon: 'none' });
    return;
  }
  const start = Number.isFinite(index) && index >= 0 ? index : 0;
  const allRemote = urls.every(
    (u) => /^https:\/\//i.test(u) || /^cloud:\/\//i.test(u)
  );
  if (allRemote) {
    wx.previewImage({ current: urls[start] || urls[0], urls });
    return;
  }
  wx.showLoading({ title: '打开中', mask: true });
  Promise.all(urls.map((u) => imageStore.toPreviewTemp(u)))
    .then((temps) => {
      wx.hideLoading();
      wx.previewImage({
        current: temps[start] || temps[0],
        urls: temps
      });
    })
    .catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '图片已失效，请重新添加', icon: 'none' });
    });
}

function previewFromList(list, e) {
  const id = e.currentTarget.dataset.id;
  const index = Number(e.currentTarget.dataset.index);
  const row = (list || []).find((item) => item && item.id === id);
  previewImages(row && row.images, index);
}

function removeAt(images, index) {
  const next = (images || []).slice();
  const removed = next.splice(index, 1)[0];
  if (removed && removed.localPath) {
    imageStore.removeFileQuiet(removed.localPath);
  }
  if (removed && removed.fileId) {
    try {
      require('../services/imageCloud').deleteFile(removed.fileId);
    } catch (e) {
      // ignore
    }
  }
  return next;
}

module.exports = {
  MAX_IMAGES,
  normalizeImages,
  pruneRemoved,
  chooseScreenshots,
  previewImages,
  previewFromList,
  removeAt
};
