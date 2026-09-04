/**
 * 图片：临时路径 → 用户目录持久化；导出/导入 base64
 * 本地 usr 路径会随开发者工具/基础库变化，展示与预览前需 resolve。
 */

function ensureDir(fs, dirPath) {
  try {
    fs.accessSync(dirPath);
  } catch (e) {
    fs.mkdirSync(dirPath, true);
  }
}

function getUserRoot() {
  return `${wx.env.USER_DATA_PATH}/images`;
}

function entryName(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.name || item.path || '';
}

function exists(path) {
  if (!path) return false;
  try {
    wx.getFileSystemManager().accessSync(path);
    return true;
  } catch (e) {
    return false;
  }
}

function slash(path) {
  return String(path || '').replace(/\\/g, '/');
}

function fileNameOf(path) {
  const s = slash(path);
  const i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}

function findByFileName(fileName) {
  if (!fileName) return '';
  const fs = wx.getFileSystemManager();
  const root = getUserRoot();
  let dirs = [];
  try {
    dirs = fs.readdirSync(root) || [];
  } catch (e) {
    return '';
  }
  for (let i = 0; i < dirs.length; i += 1) {
    const dir = `${root}/${entryName(dirs[i])}`;
    let files = [];
    try {
      files = fs.readdirSync(dir) || [];
    } catch (e) {
      continue;
    }
    for (let j = 0; j < files.length; j += 1) {
      if (entryName(files[j]) === fileName) return `${dir}/${fileName}`;
    }
  }
  return '';
}

/**
 * 把历史记录里的绝对路径 / wxfile / 旧 usr 前缀，映射到当前 USER_DATA_PATH。
 */
function resolveLocalPath(stored) {
  const raw = String(stored || '').trim();
  if (!raw) return '';
  if (/^https:\/\//i.test(raw)) return raw;
  if (exists(raw)) return raw;

  const n = slash(raw);
  const root = slash(wx.env.USER_DATA_PATH || '');
  const candidates = [];

  const imgAt = n.toLowerCase().lastIndexOf('/images/');
  if (imgAt >= 0 && root) {
    candidates.push(`${root}/${n.slice(imgAt + 1)}`);
  }
  if (n.indexOf('wxfile://usr') === 0 && root) {
    candidates.push(n.replace(/^wxfile:\/\/usr/i, root));
    candidates.push(n.replace(/^wxfile:\/\//i, 'http://'));
  }
  if (n.indexOf('http://usr') === 0 && root) {
    candidates.push(n.replace(/^http:\/\/usr/i, root));
    candidates.push(n.replace(/^http:\/\//i, 'wxfile://'));
  }
  if (n.indexOf('/usr/') >= 0 && root) {
    candidates.push(`${root}${n.slice(n.indexOf('/usr/') + 4)}`);
  }

  for (let i = 0; i < candidates.length; i += 1) {
    if (exists(candidates[i])) return candidates[i];
  }

  const found = findByFileName(fileNameOf(n));
  if (found) return found;
  return raw;
}

function resolveImages(images) {
  if (!Array.isArray(images)) return [];
  return images.map((img) => {
    if (!img || !img.localPath) return img;
    const localPath = resolveLocalPath(img.localPath);
    if (localPath === img.localPath) return img;
    return { ...img, localPath };
  });
}

function displaySrc(img) {
  if (!img) return '';
  const local = resolveLocalPath(img.localPath);
  if (local && exists(local)) return local;
  if (img.fileId) return img.fileId;
  if (img.remoteUrl) return img.remoteUrl;
  return local || '';
}

function forView(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((img, i) => {
      if (!img) return null;
      const localPath = img.localPath ? resolveLocalPath(img.localPath) : '';
      const src = displaySrc({ ...img, localPath });
      if (!src) return null;
      return {
        ...img,
        localPath: localPath || img.localPath || '',
        src,
        key: img.fileId || localPath || String(i)
      };
    })
    .filter(Boolean);
}

/**
 * @param {string} tempPath 选图临时路径
 * @param {string} dishId
 * @returns {string} localPath
 */
function persistImage(tempPath, dishId) {
  const fs = wx.getFileSystemManager();
  const root = getUserRoot();
  const dishDir = `${root}/${dishId}`;
  ensureDir(fs, root);
  ensureDir(fs, dishDir);

  const extMatch = /\.(\w+)(\?|$)/.exec(tempPath);
  const ext = (extMatch && extMatch[1]) || 'jpg';
  const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dest = `${dishDir}/${name}`;

  fs.copyFileSync(tempPath, dest);
  return dest;
}

function removeFileQuiet(path) {
  if (!path) return;
  try {
    const fs = wx.getFileSystemManager();
    fs.unlinkSync(path);
  } catch (e) {
    // 文件不存在不阻断
  }
}

function removeDishImages(images) {
  (images || []).forEach((img) => {
    if (img && img.localPath) removeFileQuiet(img.localPath);
  });
}

/**
 * 读文件为纯 base64（无 data: 前缀）
 */
function readBase64(localPath) {
  const fs = wx.getFileSystemManager();
  return fs.readFileSync(resolveLocalPath(localPath) || localPath, 'base64');
}

/**
 * 从 base64 写回用户目录
 */
function writeBase64(dishId, fileName, base64) {
  const fs = wx.getFileSystemManager();
  const root = getUserRoot();
  const dishDir = `${root}/${dishId}`;
  ensureDir(fs, root);
  ensureDir(fs, dishDir);
  const safeName = (fileName || `${Date.now()}.jpg`).replace(/[\\/]/g, '_');
  const dest = `${dishDir}/${safeName}`;
  fs.writeFileSync(dest, base64, 'base64');
  return dest;
}

function toPreviewTemp(src) {
  const resolved = resolveLocalPath(src);
  return new Promise((resolve, reject) => {
    if (!resolved) {
      reject(new Error('empty'));
      return;
    }
    if (/^https:\/\//i.test(resolved) || /^cloud:\/\//i.test(resolved)) {
      resolve(resolved);
      return;
    }
    wx.compressImage({
      src: resolved,
      quality: 80,
      success: (res) => resolve(res.tempFilePath || resolved),
      fail: () => {
        wx.getImageInfo({
          src: resolved,
          success: (info) => resolve(info.path || resolved),
          fail: reject
        });
      }
    });
  });
}

module.exports = {
  persistImage,
  removeFileQuiet,
  removeDishImages,
  readBase64,
  writeBase64,
  getUserRoot,
  exists,
  resolveLocalPath,
  resolveImages,
  displaySrc,
  forView,
  toPreviewTemp
};
