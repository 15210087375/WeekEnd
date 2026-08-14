const domain = require('../../domain/index');
const imageStore = require('../../services/imageStore');
const routes = require('../../config/routes');
const { getModule, parseKind, isRecipe } = require('../../config/modules');
const { DISH_KIND, VIRTUAL_HOME_BRAND } = require('../../utils/constants');
const { normalizeTags, normalizeLines } = require('../../utils/validate');
const { uuid } = require('../../utils/id');
const {
  FOOD_CATEGORIES,
  DEFAULT_CATEGORY,
  normalizeCategory,
  categoryIds
} = require('../../config/categories');

Page({
  data: {
    id: '',
    kind: DISH_KIND.DINE_OUT,
    isRecipe: false,
    moduleName: '',
    form: {},
    name: '',
    category: DEFAULT_CATEGORY,
    categories: FOOD_CATEGORIES,
    score: null,
    spicy: null,
    tasteTagsText: '',
    note: '',
    videoUrl: '',
    ingredientsText: '',
    stepsText: '',
    images: [],
    places: [],
    placeLabels: [],
    placeIndex: 0,
    scoreOptions: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
    _tempDishId: ''
  },

  onLoad(query) {
    let kind = parseKind(query.kind);
    this._presetPlaceId = query.placeId || '';
    this._loaded = false;
    const id = query.id || '';

    if (id) {
      const dish = domain.getDish(id);
      if (dish && dish.kind) kind = dish.kind;
    }

    const mod = getModule(kind);
    this.setData({
      id,
      kind,
      isRecipe: isRecipe(kind),
      moduleName: mod.name,
      form: mod.form,
      categories: FOOD_CATEGORIES,
      category: DEFAULT_CATEGORY,
      _tempDishId: id || uuid()
    });
    wx.setNavigationBarTitle({
      title: id ? mod.editTitle.update : mod.editTitle.create
    });
  },

  onShow() {
    this.bootstrap();
  },

  bootstrap() {
    const kind = this.data.kind;
    const recipe = isRecipe(kind);
    const ensured = domain.ensureDefaultPlace(kind);

    let places = domain.listPlaces();
    if (recipe) {
      places = places.filter((p) => p.isVirtual);
      if (!places.length) places = [ensured.place];
    } else if (!places.length) {
      places = [ensured.place];
    }

    const placeLabels = places.map((p) => domain.placeLabel(p));
    let patch = { places, placeLabels };

    if (this.data.id && !this._loaded) {
      const dish = domain.getDish(this.data.id);
      if (dish) {
        let placeIndex = places.findIndex((p) => p.id === dish.placeId);
        if (placeIndex < 0) {
          const full = domain.getPlace(dish.placeId);
          if (full) {
            places = places.concat([full]);
            placeLabels.push(domain.placeLabel(full));
            placeIndex = places.length - 1;
            patch.places = places;
            patch.placeLabels = placeLabels;
          } else {
            placeIndex = 0;
          }
        }
        const mod = getModule(dish.kind);
        patch = {
          ...patch,
          kind: dish.kind,
          isRecipe: isRecipe(dish.kind),
          moduleName: mod.name,
          form: mod.form,
          name: dish.name,
          category: normalizeCategory(dish.category),
          score: dish.score,
          spicy: dish.spicy,
          tasteTagsText: (dish.tasteTags || []).join('，'),
          note: dish.note || '',
          videoUrl: dish.videoUrl || '',
          ingredientsText: (dish.ingredients || []).join('\n'),
          stepsText: (dish.steps || []).join('\n'),
          images: dish.images || [],
          placeIndex,
          _tempDishId: dish.id
        };
        this._loaded = true;
        wx.setNavigationBarTitle({ title: mod.editTitle.update });
      }
    } else if (!this.data.id) {
      let placeIndex = 0;
      const prevId =
        (this.data.places[this.data.placeIndex] &&
          this.data.places[this.data.placeIndex].id) ||
        this._presetPlaceId ||
        '';
      if (prevId) {
        const idx = places.findIndex((p) => p.id === prevId);
        if (idx >= 0) placeIndex = idx;
      } else if (recipe) {
        const hi = places.findIndex(
          (p) => p.isVirtual && p.brandName === VIRTUAL_HOME_BRAND
        );
        if (hi >= 0) placeIndex = hi;
      } else {
        const brand = getModule(DISH_KIND.DINE_OUT).defaultPlaceBrand;
        const di = places.findIndex((p) => p.brandName === brand);
        if (di >= 0) placeIndex = di;
      }
      patch.placeIndex = placeIndex;
    } else {
      const prevId =
        this.data.places[this.data.placeIndex] &&
        this.data.places[this.data.placeIndex].id;
      let placeIndex = this.data.placeIndex || 0;
      if (prevId) {
        const idx = places.findIndex((p) => p.id === prevId);
        if (idx >= 0) placeIndex = idx;
      }
      patch.placeIndex = placeIndex;
    }

    this.setData(patch);
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  onPlacePick(e) {
    this.setData({ placeIndex: Number(e.detail.value) });
  },

  onScore(e) {
    let score = e.currentTarget.dataset.score;
    score = score === 'null' || score === null ? null : Number(score);
    this.setData({ score });
  },

  onSpicy(e) {
    let spicy = e.currentTarget.dataset.spicy;
    spicy = spicy === 'null' || spicy === null ? null : Number(spicy);
    this.setData({ spicy });
  },

  onCategory(e) {
    const id = e.currentTarget.dataset.id;
    if (!categoryIds().includes(id)) return;
    this.setData({ category: id });
  },

  goAddPlace() {
    routes.go(routes.placeEdit());
  },

  addImage() {
    const remain = 9 - this.data.images.length;
    if (remain <= 0) return;
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const dishId = this.data.id || this.data._tempDishId;
        const added = [];
        (res.tempFiles || []).forEach((f) => {
          try {
            added.push({ localPath: imageStore.persistImage(f.tempFilePath, dishId) });
          } catch (e) {
            console.error('persist image failed', e);
          }
        });
        if (added.length) {
          this.setData({ images: this.data.images.concat(added) });
        }
      }
    });
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    const images = this.data.images.slice();
    const [removed] = images.splice(index, 1);
    if (removed && removed.localPath) imageStore.removeFileQuiet(removed.localPath);
    this.setData({ images });
  },

  onSave() {
    try {
      const kind = this.data.kind;
      let { places, placeIndex } = this.data;

      if (kind === DISH_KIND.HOMEMADE) {
        const { place } = domain.ensureHomemadePlace();
        places = [place];
        placeIndex = 0;
      } else if (!places.length) {
        const ensured = domain.ensureDefaultPlace(kind);
        places = domain.listPlaces();
        placeIndex = Math.max(
          0,
          places.findIndex((p) => p.id === ensured.place.id)
        );
      }

      const row = domain.saveDish({
        id: this.data.id || this.data._tempDishId,
        placeId: places[placeIndex].id,
        kind,
        name: this.data.name,
        category: this.data.category,
        score: this.data.score,
        spicy: this.data.spicy,
        tasteTags: normalizeTags(this.data.tasteTagsText),
        note: this.data.note,
        images: this.data.images,
        ingredients: normalizeLines(this.data.ingredientsText),
        steps: normalizeLines(this.data.stepsText),
        videoUrl: this.data.videoUrl
      });

      this.setData({ id: row.id });
      this._loaded = true;
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => {
        routes.back(routes.dishDetail(row.id));
      }, 400);
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  }
});
