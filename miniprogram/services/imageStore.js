/**
 * 图片：临时路径 → 用户目录持久化；导出/导入 base64
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
  return fs.readFileSync(localPath, 'base64');
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

module.exports = {
  persistImage,
  removeFileQuiet,
  removeDishImages,
  readBase64,
  writeBase64,
  getUserRoot
};
