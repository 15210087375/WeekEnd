/**
 * 本地截图/相册导入（不写业务表）
 */
const imageStore = require('../services/imageStore');

const MAX_IMAGES = 6;

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img) => img && img.localPath)
    .map((img) => ({
      localPath: String(img.localPath),
      remoteUrl: img.remoteUrl || undefined,
      fileId: img.fileId || undefined
    }));
}

function pruneRemoved(prevImages, nextImages) {
  const nextPaths = new Set(normalizeImages(nextImages).map((i) => i.localPath));
  (prevImages || []).forEach((img) => {
    if (img && img.localPath && !nextPaths.has(img.localPath)) {
      imageStore.removeFileQuiet(img.localPath);
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
  const urls = (images || []).map((i) => i.localPath).filter(Boolean);
  if (!urls.length) return;
  wx.previewImage({
    current: urls[index] || urls[0],
    urls
  });
}

function removeAt(images, index) {
  const next = (images || []).slice();
  const removed = next.splice(index, 1)[0];
  if (removed && removed.localPath) {
    imageStore.removeFileQuiet(removed.localPath);
  }
  return next;
}

module.exports = {
  MAX_IMAGES,
  normalizeImages,
  pruneRemoved,
  chooseScreenshots,
  previewImages,
  removeAt
};
