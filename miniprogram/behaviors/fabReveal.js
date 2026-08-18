/**
 * 二级页 fixed 底栏：转场后再显示。
 *
 * 根因：position:fixed 不参与 navigateTo 的页面 transform，
 * 会先贴在屏幕底，再等整页从右侧滑入。
 *
 * 页面加：behaviors: [require('../../behaviors/fabReveal')]
 * 底栏加：class="fab-bar {{fabReady ? 'fab-ready' : ''}}"
 *
 * 全局 CSS 也兜底：.fab-bar 默认透明，.fab-ready 才显示。
 */
const DELAY_MS = 320;

module.exports = Behavior({
  data: {
    fabReady: false
  },

  onLoad() {
    this._revealFabBar();
  },

  onReady() {
    this._revealFabBar();
  },

  onUnload() {
    if (this._fabRevealTimer) {
      clearTimeout(this._fabRevealTimer);
      this._fabRevealTimer = null;
    }
  },

  methods: {
    _revealFabBar() {
      if (this.data.fabReady) return;
      if (this._fabRevealTimer) clearTimeout(this._fabRevealTimer);
      this._fabRevealTimer = setTimeout(() => {
        this.setData({ fabReady: true });
      }, DELAY_MS);
    }
  }
});
