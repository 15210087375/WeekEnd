/**
 * 美食分类标签（可扩展，改这里即可）
 * 展示：炒菜 / 烧烤 / 火锅 / 小吃 / 饮品 / 甜点
 */
const FOOD_CATEGORIES = [
  { id: 'stir_fry', label: '炒菜' },
  { id: 'bbq', label: '烧烤' },
  { id: 'hotpot', label: '火锅' },
  { id: 'snack', label: '小吃' },
  { id: 'drink', label: '饮品' },
  { id: 'dessert', label: '甜点' }
];

const DEFAULT_CATEGORY = 'stir_fry';

/** 旧版 id / 别名 → 新 id（读库兼容） */
const LEGACY_CATEGORY_MAP = {
  main: 'stir_fry',
  other: 'stir_fry',
  light: 'snack',
  // 旧「点心」归到甜点
  pastry: 'dessert',
  正餐: 'stir_fry',
  点心: 'dessert',
  其他: 'stir_fry'
};

const LABEL_MAP = FOOD_CATEGORIES.reduce((acc, c) => {
  acc[c.id] = c.label;
  return acc;
}, {});

function normalizeCategory(raw) {
  if (!raw) return DEFAULT_CATEGORY;
  const key = String(raw).trim();
  if (LABEL_MAP[key]) return key;
  if (LEGACY_CATEGORY_MAP[key]) return LEGACY_CATEGORY_MAP[key];
  // 兼容中文直填
  const hit = FOOD_CATEGORIES.find((c) => c.label === key);
  if (hit) return hit.id;
  return DEFAULT_CATEGORY;
}

function categoryLabel(id) {
  return LABEL_MAP[normalizeCategory(id)] || LABEL_MAP[DEFAULT_CATEGORY];
}

function categoryLabels() {
  return FOOD_CATEGORIES.map((c) => c.label);
}

function categoryIds() {
  return FOOD_CATEGORIES.map((c) => c.id);
}

module.exports = {
  FOOD_CATEGORIES,
  DEFAULT_CATEGORY,
  LEGACY_CATEGORY_MAP,
  normalizeCategory,
  categoryLabel,
  categoryLabels,
  categoryIds
};
