/**
 * 备份文件读写（大体积走文件，不走剪贴板）
 * 导出：写入用户目录 → 分享文件 / 打开文档
 * 导入：从聊天记录选文件
 */

const BACKUP_DIR = 'backup';
const FILE_PREFIX = 'wfa-backup';

function fs() {
  return wx.getFileSystemManager();
}

function userRoot() {
  return `${wx.env.USER_DATA_PATH}/${BACKUP_DIR}`;
}

function ensureDir() {
  const dir = userRoot();
  try {
    fs().accessSync(dir);
  } catch (e) {
    fs().mkdirSync(dir, true);
  }
  return dir;
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function moduleTag(pkg) {
  const mods = (pkg && pkg.modules) || [];
  if (!mods.length || mods.indexOf('all') >= 0) return 'all';
  if (mods.length >= 3) return 'all';
  return mods.join('-') || 'all';
}

function buildFileName(exportedAt, tag) {
  const d = new Date(exportedAt || Date.now());
  const stamp = [
    d.getFullYear(),
    pad2(d.getMonth() + 1),
    pad2(d.getDate()),
    '_',
    pad2(d.getHours()),
    pad2(d.getMinutes()),
    pad2(d.getSeconds())
  ].join('');
  const mid = tag ? `${tag}-` : '';
  return `${FILE_PREFIX}-${mid}${stamp}.json`;
}

/**
 * 将备份对象写成用户目录 JSON 文件
 * @returns {{ filePath: string, fileName: string, size: number }}
 */
function writeBackupFile(pkg) {
  ensureDir();
  const tag = moduleTag(pkg);
  const fileName = buildFileName(pkg && pkg.exportedAt, tag);
  const filePath = `${userRoot()}/${fileName}`;
  const text = JSON.stringify(pkg);
  // utf8 文本；大文件用同步写（备份场景用户主动触发）
  fs().writeFileSync(filePath, text, 'utf8');
  let size = 0;
  try {
    const st = fs().statSync(filePath);
    size = st.size || text.length;
  } catch (e) {
    size = text.length;
  }
  return { filePath, fileName, size };
}

/**
 * 分享备份文件到微信会话（真机可用；开发者工具可能受限）
 */
function shareBackupFile(filePath, fileName) {
  return new Promise((resolve, reject) => {
    if (!wx.shareFileMessage) {
      reject(new Error('当前基础库不支持文件分享，请升级微信'));
      return;
    }
    wx.shareFileMessage({
      filePath,
      fileName: fileName || 'wfa-backup.json',
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 用系统文档方式打开（部分端可另存）
 */
function openBackupFile(filePath) {
  return new Promise((resolve, reject) => {
    wx.openDocument({
      filePath,
      showMenu: true,
      fileType: 'text',
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 从微信聊天选备份文件并解析 JSON
 * @returns {Promise<object>} 备份包对象
 */
function chooseAndReadBackup() {
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success(res) {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.path) {
          reject(new Error('未选择文件'));
          return;
        }
        try {
          // 优先 utf8 文本读；失败再当二进制转字符串
          let text;
          try {
            text = fs().readFileSync(file.path, 'utf8');
          } catch (e1) {
            const buf = fs().readFileSync(file.path);
            if (typeof buf === 'string') text = buf;
            else text = buf.toString('utf8');
          }
          if (!text || !String(text).trim()) {
            reject(new Error('文件为空'));
            return;
          }
          let pkg;
          try {
            pkg = JSON.parse(text);
          } catch (e) {
            reject(new Error('不是有效的 JSON 备份文件'));
            return;
          }
          resolve({ pkg, fileName: file.name || '', size: file.size || 0 });
        } catch (e) {
          reject(e);
        }
      },
      fail(err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) {
          reject(new Error('cancel'));
          return;
        }
        reject(err || new Error('选择文件失败'));
      }
    });
  });
}

function formatSize(bytes) {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

module.exports = {
  writeBackupFile,
  shareBackupFile,
  openBackupFile,
  chooseAndReadBackup,
  formatSize,
  buildFileName
};
