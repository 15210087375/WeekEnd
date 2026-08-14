const domain = require('./domain/index');

App({
  onLaunch() {
    try {
      domain.init();
    } catch (e) {
      console.error('[app] domain.init failed', e);
    }
    // 有云配置则静默登录；失败不打扰用户
    try {
      domain.ensureSilentLogin();
    } catch (e) {
      console.warn('[app] silent login skip', e);
    }
  },
  globalData: {
    schemaVersion: 1,
    /** 从 archive 等页跳回美食 Tab 时预选 kind */
    pendingFoodKind: '',
    /** 选菜下单返回后：首页 onShow 自动打开半屏购物车 */
    openCartOnShow: false
  }
});
