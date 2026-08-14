/**
 * 搜索 Tab：搜索 + 目录（原浏览，只读无加号）
 */
const dishItem = require('../../presenters/dishItem');
const domain = require('../../domain/index');
const routes = require('../../config/routes');

Page({
  data: {
    mode: 'search', // search | browse
    // search
    keyword: '',
    kind: '',
    spicy: '',
    minScore: '',
    list: [],
    searched: false,
    // browse
    level: 'region',
    regionId: '',
    regionName: '',
    mallId: '',
    mallName: '',
    regions: [],
    malls: [],
    places: []
  },

  onShow() {
    if (this.data.mode === 'search' && this.data.searched) {
      this.onSearch();
    }
    if (this.data.mode === 'browse') {
      this.refreshBrowse();
    }
  },

  onMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.mode) return;
    this.setData({ mode }, () => {
      if (mode === 'browse') this.refreshBrowse();
      if (mode === 'search' && this.data.searched) this.onSearch();
    });
  },

  // ---- search ----
  onKeyword(e) {
    this.setData({ keyword: e.detail.value });
  },

  onKind(e) {
    this.setData({ kind: e.currentTarget.dataset.kind });
  },

  onSpicy(e) {
    let spicy = e.currentTarget.dataset.spicy;
    spicy = spicy === '' ? '' : Number(spicy);
    this.setData({ spicy });
  },

  onMinScore(e) {
    let minScore = e.currentTarget.dataset.score;
    minScore = minScore === '' ? '' : Number(minScore);
    this.setData({ minScore });
  },

  onSearch() {
    const { keyword, kind, spicy, minScore } = this.data;
    const list = dishItem.search({
      keyword,
      kind: kind || undefined,
      spicy: spicy === '' ? undefined : spicy,
      minScore: minScore === '' ? undefined : minScore
    });
    this.setData({ list, searched: true });
  },

  goDish(e) {
    routes.go(routes.dishDetail(e.currentTarget.dataset.id));
  },

  // ---- browse (read-only tree) ----
  refreshBrowse() {
    const { level, regionId, mallId } = this.data;
    if (level === 'region') {
      this.setData({ regions: domain.listRegions() });
      return;
    }
    if (level === 'mall') {
      const region = domain.getRegion(regionId);
      this.setData({
        regionName: region ? region.name : '',
        malls: domain.listMalls(regionId)
      });
      return;
    }
    let places;
    if (mallId === '__all__') {
      places = domain.listPlaces({ regionId });
    } else if (mallId === '' || mallId == null) {
      places = domain.listPlaces({ regionId, mallId: null });
    } else {
      places = domain.listPlaces({ regionId, mallId });
    }
    this.setData({ places });
  },

  goLevel(e) {
    const level = e.currentTarget.dataset.level;
    if (level === 'region') {
      this.setData(
        { level: 'region', regionId: '', mallId: '', mallName: '' },
        () => this.refreshBrowse()
      );
    } else if (level === 'mall') {
      this.setData({ level: 'mall', mallId: '', mallName: '' }, () =>
        this.refreshBrowse()
      );
    }
  },

  openRegion(e) {
    const id = e.currentTarget.dataset.id;
    const region = domain.getRegion(id);
    this.setData(
      {
        level: 'mall',
        regionId: id,
        regionName: region ? region.name : '',
        mallId: '',
        mallName: ''
      },
      () => this.refreshBrowse()
    );
  },

  openMall(e) {
    const id = e.currentTarget.dataset.id;
    const m = domain.getMall(id);
    this.setData(
      {
        level: 'place',
        mallId: id,
        mallName: m ? m.name : ''
      },
      () => this.refreshBrowse()
    );
  },

  openStreetPlaces() {
    this.setData({ level: 'place', mallId: '', mallName: '街边店' }, () =>
      this.refreshBrowse()
    );
  },

  openAllPlaces() {
    this.setData({ level: 'place', mallId: '__all__', mallName: '全部' }, () =>
      this.refreshBrowse()
    );
  },

  openPlace(e) {
    routes.go(routes.placeDetail(e.currentTarget.dataset.id));
  }
});
