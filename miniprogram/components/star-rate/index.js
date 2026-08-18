function clampScore(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(10, Math.max(0, Math.round(n)));
}

function buildStars(value) {
  const v = clampScore(value);
  return [1, 2, 3, 4, 5].map((i) => {
    const fullAt = i * 2;
    const halfAt = i * 2 - 1;
    let fill = 'none';
    if (v >= fullAt) fill = 'full';
    else if (v >= halfAt) fill = 'half';
    return { i, fill, half: halfAt, full: fullAt };
  });
}

Component({
  options: {
    virtualHost: true
  },
  properties: {
    value: { type: Number, value: 0 },
    readonly: { type: Boolean, value: false },
    nullable: { type: Boolean, value: false },
    size: { type: Number, value: 40 }
  },

  data: {
    stars: buildStars(0),
    display: '0'
  },

  observers: {
    value(v) {
      const n = clampScore(v);
      this.setData({
        stars: buildStars(n),
        display: n ? String(n) : '0'
      });
    }
  },

  methods: {
    onTapHalf(e) {
      if (this.properties.readonly) return;
      const n = Number(e.currentTarget.dataset.n);
      if (!Number.isFinite(n)) return;
      const cur = clampScore(this.properties.value);
      let next = cur === n ? 0 : n;
      if (this.properties.nullable && next === 0) {
        this.setData({ stars: buildStars(0), display: '0' });
        this.triggerEvent('change', { value: null });
        return;
      }
      this.setData({
        stars: buildStars(next),
        display: next ? String(next) : '0'
      });
      this.triggerEvent('change', { value: next });
    }
  }
});
