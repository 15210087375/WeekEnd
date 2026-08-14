/**
 * 列表展示模型：领域实体 → 页面 list item
 */
const domain = require('../domain/index');
const { SPICY_LABELS, KIND_LABELS } = require('../utils/constants');
const { isRecipe } = require('../config/modules');
const { categoryLabel, normalizeCategory } = require('../config/categories');
const { formatDateTime } = require('../utils/format');

function spicyLabel(spicy) {
  if (spicy == null) return '';
  return SPICY_LABELS[spicy] || '';
}

function toListItem(dish, options) {
  const opts = options || {};
  const enriched = domain.enrichDish(dish);
  const recipe = isRecipe(dish.kind);
  let subLine = '';

  if (opts.mode === 'history') {
    subLine = enriched.placeLabel || '';
  } else if (recipe) {
    subLine = enriched.placeLabel || '自做';
  } else {
    const parts = [];
    if (enriched.region && enriched.region.name) parts.push(enriched.region.name);
    if (enriched.mall && enriched.mall.name) parts.push(enriched.mall.name);
    if (enriched.placeLabel) parts.push(enriched.placeLabel);
    subLine = parts.join(' · ') || '未挂门店';
  }

  const catId = normalizeCategory(dish.category);
  return {
    id: dish.id,
    name: dish.name,
    score: dish.score,
    kind: dish.kind,
    kindLabel: KIND_LABELS[dish.kind] || dish.kind,
    isRecipe: recipe,
    category: catId,
    categoryLabel: categoryLabel(catId),
    placeLabel: enriched.placeLabel || '',
    subLine,
    spicyLabel: spicyLabel(dish.spicy),
    tasteTags: dish.tasteTags || [],
    stepCount: (dish.steps || []).length,
    ingCount: (dish.ingredients || []).length,
    timeText: formatDateTime(dish.updatedAt || dish.createdAt),
    images: dish.images || [],
    selected: false
  };
}

function listByKind(kind, options) {
  const filter = { ...(options && options.filter) };
  if (kind) filter.kind = kind;
  return domain.listDishes(filter).map((d) => toListItem(d, options));
}

function search(filter, options) {
  return domain.searchDishes(filter || {}).map((d) => toListItem(d, options));
}

module.exports = {
  toListItem,
  listByKind,
  search,
  spicyLabel
};
