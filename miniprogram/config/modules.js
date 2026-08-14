/**
 * 产品功能分区（入口 / 文案 / 字段策略）
 * 新增业务线：在此加分区配置，页面只读配置，不写死 if-else 文案。
 */
const { DISH_KIND } = require('../utils/constants');

/** @typedef {'dine_out'|'homemade'} DishKind */

const MODULES = {
  [DISH_KIND.DINE_OUT]: {
    kind: DISH_KIND.DINE_OUT,
    /** 产品名 */
    name: '美食档案',
    shortName: '外出',
    desc: '外出就餐：区域 / 门店 / 评分 / 辣度',
    listDesc: '外出就餐：门店、评分、辣度与口味',
    addLabel: '录入美食',
    emptyText: '暂无外出美食档案',
    editTitle: { create: '录入美食档案', update: '编辑美食档案' },
    theme: 'out', // 绿
    /** 表单展示哪些块 */
    form: {
      place: true,
      score: true,
      spicy: true,
      tasteTags: true,
      note: true,
      images: true,
      ingredients: false,
      steps: false,
      videoUrl: false
    },
    defaultPlaceBrand: '待归类'
  },
  [DISH_KIND.HOMEMADE]: {
    kind: DISH_KIND.HOMEMADE,
    name: '我的菜谱',
    shortName: '菜谱',
    desc: '自己做：用料 / 步骤 / 抖音口令',
    listDesc: '自做菜：用料、步骤与抖音分享口令',
    addLabel: '录菜谱',
    emptyText: '暂无自做菜谱',
    editTitle: { create: '录菜谱', update: '编辑菜谱' },
    theme: 'home', // 橙
    form: {
      place: false,
      score: true, // 可选自评
      spicy: false,
      tasteTags: false,
      note: true,
      images: true,
      ingredients: true,
      steps: true,
      videoUrl: true
    },
    defaultPlaceBrand: '自做/家庭'
  }
};

function getModule(kind) {
  return MODULES[kind] || MODULES[DISH_KIND.DINE_OUT];
}

function parseKind(raw) {
  return raw === DISH_KIND.HOMEMADE ? DISH_KIND.HOMEMADE : DISH_KIND.DINE_OUT;
}

function isRecipe(kind) {
  return kind === DISH_KIND.HOMEMADE;
}

/** 首页双入口顺序 */
const HOME_ENTRIES = [DISH_KIND.DINE_OUT, DISH_KIND.HOMEMADE];

module.exports = {
  MODULES,
  HOME_ENTRIES,
  getModule,
  parseKind,
  isRecipe
};
