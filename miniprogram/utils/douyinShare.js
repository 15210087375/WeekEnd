/**
 * 抖音完整分享口令 → 剪切板 + 引导打开抖音（不唤起 App、不用 scheme）
 * 口令来源：抖音 App「分享 → 复制链接」的完整文本，勿只存裸 URL。
 */

const BTN_LABEL = '复制链接，去抖音打开';
const NO_LINK = '暂无可用链接';
const FAIL_TOAST = '复制失败，请重试';
const OK_TITLE = '链接已复制';
const OK_CONTENT =
  '请打开抖音。若弹出提示请点「打开」；没有提示时，到搜索框粘贴即可。';

/**
 * @param {string} shareText 完整官方分享口令
 */
function copyDouyinShareText(shareText) {
  const text = String(shareText || '').trim();
  if (!text) {
    wx.showToast({ title: NO_LINK, icon: 'none' });
    return;
  }
  wx.setClipboardData({
    data: text,
    success() {
      wx.showModal({
        title: OK_TITLE,
        content: OK_CONTENT,
        showCancel: false
      });
    },
    fail() {
      wx.showToast({ title: FAIL_TOAST, icon: 'none' });
    }
  });
}

function hasShareText(shareText) {
  return !!String(shareText || '').trim();
}

module.exports = {
  BTN_LABEL,
  NO_LINK,
  copyDouyinShareText,
  hasShareText
};
