/**
 * 预注入即将打开的二级页，避免 Tab 栏先卸掉后空等页面编译。
 */
function page(url) {
  if (!url || typeof wx === 'undefined' || !wx.preloadPage) return;
  try {
    wx.preloadPage({ url: String(url).split('?')[0] });
  } catch (e) {
    // 低版本或重复预载忽略
  }
}

function funRoutes(routes) {
  page(routes.watch());
  page(routes.wishList());
}

module.exports = { page, funRoutes };
