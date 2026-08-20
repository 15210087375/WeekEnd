/**
 * 可拖拽圆球：松手按中线吸左/右，记住位置。
 * 轻点走页面的 onFabClick。
 */
function getSys() {
  try {
    return wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  } catch (e) {
    return { windowWidth: 375, windowHeight: 667, statusBarHeight: 20, safeArea: null };
  }
}

function rpx(sys, n) {
  return Math.round((sys.windowWidth / 750) * n);
}

function safeBottom(sys) {
  if (sys.safeArea && typeof sys.safeArea.bottom === 'number') {
    return Math.max(0, sys.windowHeight - sys.safeArea.bottom);
  }
  return 0;
}

function fabDock(opts) {
  const storageKey = opts.storageKey;
  const defaultSide = opts.defaultSide === 'left' ? 'left' : 'right';
  const sizeRpx = opts.sizeRpx || 112;
  const padRpx = opts.padRpx || 28;
  const bottomRpx = opts.bottomRpx || 180;

  return Behavior({
    data: {
      fabX: 0,
      fabY: 0,
      fabDragging: false,
      fabInited: false
    },

    methods: {
      initFabPos() {
        const sys = getSys();
        const size = rpx(sys, sizeRpx);
        const def = this._defaultFabPos(sys, size);
        let x = def.x;
        let y = def.y;
        try {
          const saved = wx.getStorageSync(storageKey);
          if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
            x = saved.x;
            y = saved.y;
          }
        } catch (e) {
          // ignore
        }
        const snapped = this._snapFab(x, y, sys, size);
        this.setData({
          fabX: snapped.x,
          fabY: snapped.y,
          fabInited: true
        });
      },

      _defaultFabPos(sys, size) {
        const pad = rpx(sys, padRpx);
        const bottom = rpx(sys, bottomRpx) + safeBottom(sys);
        return {
          x: defaultSide === 'left' ? pad : sys.windowWidth - size - pad,
          y: sys.windowHeight - size - bottom
        };
      },

      _clampFabY(y, sys, size) {
        const top = (sys.statusBarHeight || 20) + 44;
        const pad = rpx(sys, padRpx);
        const maxY = sys.windowHeight - size - safeBottom(sys) - pad;
        return Math.min(Math.max(y, top), maxY);
      },

      _snapFab(x, y, sys, size) {
        const pad = rpx(sys, padRpx);
        const center = x + size / 2;
        const snapX = center < sys.windowWidth / 2 ? pad : sys.windowWidth - size - pad;
        return {
          x: snapX,
          y: this._clampFabY(y, sys, size)
        };
      },

      onFabStart(e) {
        const t = e.touches && e.touches[0];
        if (!t) return;
        this._fabDrag = {
          startX: t.clientX,
          startY: t.clientY,
          originX: this.data.fabX,
          originY: this.data.fabY,
          moved: false
        };
      },

      onFabMove(e) {
        const drag = this._fabDrag;
        const t = e.touches && e.touches[0];
        if (!drag || !t) return;
        const dx = t.clientX - drag.startX;
        const dy = t.clientY - drag.startY;
        if (Math.abs(dx) + Math.abs(dy) > 8) {
          drag.moved = true;
        }
        const sys = getSys();
        const size = rpx(sys, sizeRpx);
        let x = drag.originX + dx;
        let y = drag.originY + dy;
        x = Math.min(Math.max(x, 0), sys.windowWidth - size);
        y = this._clampFabY(y, sys, size);
        this.setData({ fabX: x, fabY: y, fabDragging: true });
      },

      onFabEnd() {
        const drag = this._fabDrag;
        this._fabDrag = null;
        if (!drag || !drag.moved) {
          this.setData({ fabDragging: false });
          if (typeof this.onFabClick === 'function') {
            this.onFabClick();
          }
          return;
        }
        const sys = getSys();
        const size = rpx(sys, sizeRpx);
        const snapped = this._snapFab(this.data.fabX, this.data.fabY, sys, size);
        this.setData({
          fabX: snapped.x,
          fabY: snapped.y,
          fabDragging: false
        });
        try {
          wx.setStorageSync(storageKey, snapped);
        } catch (e) {
          // ignore
        }
      }
    }
  });
}

module.exports = fabDock;
