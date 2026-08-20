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

Component({
  properties: {
    color: {
      type: String,
      value: '#5b6cff'
    },
    storageKey: {
      type: String,
      value: 'funPlusFabPos'
    },
    defaultSide: {
      type: String,
      value: 'right'
    },
    bottomRpx: {
      type: Number,
      value: 180
    }
  },

  data: {
    fabX: 0,
    fabY: 0,
    fabDragging: false,
    fabInited: false
  },

  lifetimes: {
    attached() {
      this.initFabPos();
    }
  },

  methods: {
    initFabPos() {
      const sys = getSys();
      const size = rpx(sys, 112);
      const def = this.defaultFabPos(sys, size);
      let x = def.x;
      let y = def.y;
      try {
        let saved = wx.getStorageSync(this.data.storageKey);
        if (!saved) {
          saved = wx.getStorageSync('scheduleFabPos.v2');
        }
        if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
          x = saved.x;
          y = saved.y;
        }
      } catch (e) {
        // ignore
      }
      const snapped = this.snapFab(x, y, sys, size);
      this.setData({
        fabX: snapped.x,
        fabY: snapped.y,
        fabInited: true
      });
    },

    defaultFabPos(sys, size) {
      const pad = rpx(sys, 28);
      const bottom = rpx(sys, this.data.bottomRpx) + safeBottom(sys);
      const side = this.data.defaultSide === 'left' ? 'left' : 'right';
      return {
        x: side === 'left' ? pad : sys.windowWidth - size - pad,
        y: sys.windowHeight - size - bottom
      };
    },

    clampFabY(y, sys, size) {
      const top = (sys.statusBarHeight || 20) + 44;
      const pad = rpx(sys, 28);
      const maxY = sys.windowHeight - size - safeBottom(sys) - pad;
      return Math.min(Math.max(y, top), maxY);
    },

    snapFab(x, y, sys, size) {
      const pad = rpx(sys, 28);
      const center = x + size / 2;
      const snapX = center < sys.windowWidth / 2 ? pad : sys.windowWidth - size - pad;
      return {
        x: snapX,
        y: this.clampFabY(y, sys, size)
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
      const size = rpx(sys, 112);
      let x = drag.originX + dx;
      let y = drag.originY + dy;
      x = Math.min(Math.max(x, 0), sys.windowWidth - size);
      y = this.clampFabY(y, sys, size);
      this.setData({ fabX: x, fabY: y, fabDragging: true });
    },

    onFabEnd() {
      const drag = this._fabDrag;
      this._fabDrag = null;
      if (!drag || !drag.moved) {
        this.setData({ fabDragging: false });
        this.triggerEvent('click');
        return;
      }
      const sys = getSys();
      const size = rpx(sys, 112);
      const snapped = this.snapFab(this.data.fabX, this.data.fabY, sys, size);
      this.setData({
        fabX: snapped.x,
        fabY: snapped.y,
        fabDragging: false
      });
      try {
        wx.setStorageSync(this.data.storageKey, snapped);
      } catch (e) {
        // ignore
      }
    }
  }
});
