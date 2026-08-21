function clamp(n, a, b) {
  return Math.min(Math.max(n, a), b);
}

function wrap(i, n) {
  if (!n) return 0;
  return ((i % n) + n) % n;
}

const STACK_VISIBLE = 3;
const STACK_EXTRA = 1;
const SCALE_STEP = 0.06;
const PEEK = 36;

function normalize(item, i) {
  const id = item.id != null ? item.id : item.kind != null ? item.kind : i;
  const count = item.count;
  return {
    ...item,
    id,
    title: item.title || item.name || '',
    desc: item.desc || '',
    icon: item.icon || '',
    theme: item.theme || 'fun',
    countText: count == null || count === '' ? '' : `${count} 条`
  };
}

Component({
  properties: {
    list: {
      type: Array,
      value: []
    },
    direction: {
      type: String,
      value: 'horizontal'
    },
    height: {
      type: String,
      value: ''
    },
    loop: {
      type: Boolean,
      value: true
    },
    current: {
      type: Number,
      value: 0
    },
    autoplay: {
      type: Boolean,
      value: true
    },
    interval: {
      type: Number,
      value: 5000
    }
  },

  data: {
    index: 0,
    layers: [],
    stageHeight: '520rpx',
    drag: 0,
    dragging: false,
    animating: false
  },

  observers: {
    'list, direction, height'() {
      this.syncFromProps();
    },
    current(v) {
      const n = (this._list || this.data.list || []).length;
      if (!n) return;
      const index = wrap(Number(v) || 0, n);
      if (index === this.data.index) return;
      this.setData({ index }, () => this.paint());
    }
  },

  lifetimes: {
    attached() {
      this.syncFromProps();
      this.measure();
      this.resetAutoplay();
    },
    detached() {
      this.stopAutoplay();
      clearTimeout(this._timer);
    }
  },

  pageLifetimes: {
    show() {
      this.resetAutoplay();
    },
    hide() {
      this.stopAutoplay();
    }
  },

  methods: {
    isVertical() {
      return this.data.direction === 'vertical';
    },

    syncFromProps() {
      const list = (this.data.list || []).map(normalize);
      const n = list.length;
      let index = this.data.index;
      if (n && index >= n) index = 0;
      const stageHeight =
        this.data.height || (this.isVertical() ? '240rpx' : '520rpx');
      this._list = list;
      this.setData({ index, stageHeight }, () => {
        this.paint();
        this.resetAutoplay();
      });
    },

    measure() {
      const q = this.createSelectorQuery();
      q.select('.stage').boundingClientRect();
      q.exec((res) => {
        const rect = res && res[0];
        this._box = rect || { width: 300, height: 260 };
        this.paint();
      });
    },

    paint(extra) {
      const list = this._list || [];
      const n = list.length;
      const index = this.data.index;
      const drag = extra && extra.drag != null ? extra.drag : this.data.drag;
      const dragging = !!(extra && extra.dragging != null
        ? extra.dragging
        : this.data.dragging);
      const animating = !!(extra && extra.animating != null
        ? extra.animating
        : this.data.animating);
      const layers = this.buildLayers(list, index, drag, dragging, animating);
      this.setData({
        layers,
        drag,
        dragging,
        animating,
        index
      });
    },

    buildLayers(list, index, drag, dragging, animating) {
      const n = list.length;
      if (!n) return [];
      const box = this._box || { width: 300, height: 260 };
      const vertical = this.isVertical();
      const size = vertical ? box.height : box.width;
      const depth = STACK_VISIBLE + STACK_EXTRA;
      const showPrev = drag > 12 || (animating && drag > 0);
      const trans =
        dragging || !animating
          ? 'none'
          : 'transform 0.28s ease, opacity 0.28s ease';
      const peek = PEEK;
      const lastBack = STACK_VISIBLE - 1;
      const lastScale = 1 - lastBack * SCALE_STEP;
      const lastPeek = lastBack * peek;
      const cardMain =
        lastScale > 0 ? (size - lastPeek) / lastScale : size;
      const inset = Math.max(0, Math.round(size - cardMain));
      const edge = vertical ? `bottom: ${inset}px` : `right: ${inset}px`;
      const progressNext = drag < 0 ? clamp(-drag / 72, 0, 1) : 0;
      const progressPrev = drag > 0 ? clamp(drag / 72, 0, 1) : 0;
      const layers = [];

      if (showPrev) {
        const item = list[wrap(index - 1, n)];
        const x = vertical ? 0 : -size + drag;
        const y = vertical ? -size + drag : 0;
        layers.push({
          ...item,
          slot: `c${index - 1}`,
          style: [
            `transform: translate(${x}px, ${y}px) scale(1)`,
            'z-index: 40',
            'opacity: 1',
            `transition: ${trans}`,
            edge
          ].join(';')
        });
      }

      for (let d = depth - 1; d >= 0; d--) {
        const seq = index + d;
        const item = list[wrap(seq, n)];
        let back = d;
        if (drag < 0) back = Math.max(0, d - progressNext);
        else if (drag > 0 && d === 0) back = progressPrev;
        const x = vertical ? 0 : back * peek + (d === 0 && drag < 0 ? drag : 0);
        const y = vertical
          ? back * peek + (d === 0 && drag < 0 ? drag : 0)
          : 0;
        const scale = 1 - Math.min(back, lastBack) * SCALE_STEP;
        const opacity = clamp(STACK_VISIBLE - back, 0, 1);
        layers.push({
          ...item,
          slot: `c${seq}`,
          style: [
            `transform: translate(${x}px, ${y}px) scale(${scale})`,
            `z-index: ${30 - d}`,
            `opacity: ${opacity}`,
            `transition: ${trans}`,
            edge,
            opacity === 0 ? 'pointer-events: none' : ''
          ].join(';')
        });
      }
      return layers;
    },

    onTouchStart(e) {
      if (this.data.animating) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      this.stopAutoplay();
      this._g = {
        x: t.clientX,
        y: t.clientY,
        axis: null,
        moved: false
      };
    },

    onTouchMove(e) {
      const g = this._g;
      const t = e.touches && e.touches[0];
      if (!g || !t || this.data.animating) return;
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      const vertical = this.isVertical();
      if (!g.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        const primary = vertical ? Math.abs(dy) >= Math.abs(dx) : Math.abs(dx) >= Math.abs(dy);
        g.axis = primary ? 'main' : 'lock';
      }
      if (g.axis !== 'main') return;
      const drag = vertical ? dy : dx;
      if (Math.abs(drag) > 8) g.moved = true;
      this.paint({ drag, dragging: true, animating: false });
    },

    onTouchEnd() {
      const g = this._g;
      this._g = null;
      if (this.data.animating) return;
      const drag = this.data.drag || 0;
      if (!g || !g.moved) {
        this.paint({ drag: 0, dragging: false, animating: false });
        this.resetAutoplay();
        const item = (this._list || [])[this.data.index];
        if (item) {
          this.triggerEvent('itemtap', { index: this.data.index, item });
        }
        return;
      }
      this._skipTap = true;
      const n = (this._list || []).length;
      const box = this._box || { width: 300, height: 260 };
      const size = this.isVertical() ? box.height : box.width;
      const threshold = Math.min(72, size * 0.18);
      const index = this.data.index;
      const loop = this.data.loop !== false;
      if (n < 2) {
        this.finish(0, index);
        return;
      }
      if (drag < -threshold && (loop || index < n - 1)) {
        this.finish(-size, wrap(index + 1, n));
        return;
      }
      if (drag > threshold && (loop || index > 0)) {
        this.finish(size, wrap(index - 1, n));
        return;
      }
      this.finish(0, index);
    },

    finish(toDrag, nextIndex) {
      const changed = nextIndex !== this.data.index;
      this.stopAutoplay();
      this.paint({ drag: toDrag, dragging: false, animating: true });
      clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        this.setData({ index: nextIndex, drag: 0, dragging: false, animating: false }, () => {
          this.paint({ drag: 0, dragging: false, animating: false });
          if (changed) {
            const item = (this._list || [])[nextIndex];
            this.triggerEvent('change', { index: nextIndex, item });
          }
          this.resetAutoplay();
        });
      }, 280);
    },

    stopAutoplay() {
      if (this._autoTimer) {
        clearTimeout(this._autoTimer);
        this._autoTimer = null;
      }
    },

    resetAutoplay() {
      this.stopAutoplay();
      if (this.properties.autoplay === false) return;
      const n = (this._list || []).length;
      if (n < 2) return;
      const ms = Number(this.properties.interval);
      const interval = ms > 0 ? ms : 5000;
      this._autoTimer = setTimeout(() => this.autoNext(), interval);
    },

    autoNext() {
      if (this._g || this.data.dragging || this.data.animating) {
        this.resetAutoplay();
        return;
      }
      const n = (this._list || []).length;
      if (n < 2) return;
      const loop = this.data.loop !== false;
      const index = this.data.index;
      if (!loop && index >= n - 1) return;
      const box = this._box || { width: 300, height: 260 };
      const size = this.isVertical() ? box.height : box.width;
      this.finish(-size, wrap(index + 1, n));
    }

  }
});
