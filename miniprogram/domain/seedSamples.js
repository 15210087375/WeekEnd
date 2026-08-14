/**
 * 测试用家常菜种子（10 道，homemade）
 * 可重复调用：同名已存在则跳过
 */
const dish = require('./dish');
const seed = require('./seed');
const cache = require('./cache');
const { DISH_KIND } = require('../utils/constants');

/** @type {Array<object>} */
const HOMEMADE_SAMPLES = [
  {
    name: '番茄炒蛋',
    category: 'stir_fry',
    score: 4.5,
    spicy: 0,
    ingredients: ['鸡蛋 3 个', '番茄 2 个', '盐', '糖少许', '葱花'],
    steps: ['鸡蛋打散加盐', '番茄切块炒出汁', '倒入蛋液炒熟', '调味出锅'],
    note: '经典家常，微甜更好吃'
  },
  {
    name: '青椒肉丝',
    category: 'stir_fry',
    score: 4,
    spicy: 1,
    ingredients: ['猪肉丝 200g', '青椒 2 个', '生抽', '料酒', '淀粉'],
    steps: ['肉丝腌制', '青椒切丝', '滑炒肉丝盛出', '炒青椒后合炒'],
    note: '下饭快手菜'
  },
  {
    name: '蒜蓉西兰花',
    category: 'stir_fry',
    score: 4,
    spicy: 0,
    ingredients: ['西兰花 1 棵', '蒜末', '盐', '蚝油少许'],
    steps: ['西兰花焯水', '蒜末爆香', '大火快炒调味'],
    note: '清淡配菜'
  },
  {
    name: '红烧排骨',
    category: 'stir_fry',
    score: 5,
    spicy: 0,
    ingredients: ['排骨 500g', '冰糖', '生抽老抽', '料酒', '姜片', '八角'],
    steps: ['排骨焯水', '炒糖色', '下排骨上色', '加水小火焖 40 分钟'],
    note: '周末硬菜'
  },
  {
    name: '土豆炖牛腩',
    category: 'stir_fry',
    score: 4.5,
    spicy: 0,
    ingredients: ['牛腩 400g', '土豆 2 个', '胡萝卜', '葱姜', '八角桂皮'],
    steps: ['牛腩焯水切块', '炒香香料下肉', '加水炖软', '下土豆再炖 15 分钟'],
    note: '一锅出，汤也好喝'
  },
  {
    name: '麻婆豆腐',
    category: 'stir_fry',
    score: 4.5,
    spicy: 2,
    ingredients: ['嫩豆腐 1 盒', '牛肉末', '豆瓣酱', '花椒粉', '蒜苗'],
    steps: ['豆腐焯水', '炒肉末下豆瓣', '下豆腐小火收汁', '撒花椒粉蒜苗'],
    note: '微辣下饭'
  },
  {
    name: '蛋炒饭',
    category: 'stir_fry',
    score: 4,
    spicy: 0,
    ingredients: ['隔夜米饭 1 碗', '鸡蛋 2 个', '葱花', '盐', '生抽少许'],
    steps: ['蛋液炒散盛出', '米饭炒散', '合炒蛋与葱花调味'],
    note: '剩饭救星'
  },
  {
    name: '紫菜蛋花汤',
    category: 'drink',
    score: 3.5,
    spicy: 0,
    ingredients: ['紫菜', '鸡蛋 1 个', '香油', '盐', '葱花'],
    steps: ['水烧开下紫菜', '淋入蛋液', '调味滴香油'],
    note: '快手汤'
  },
  {
    name: '凉拌黄瓜',
    category: 'snack',
    score: 4,
    spicy: 1,
    ingredients: ['黄瓜 2 根', '蒜', '醋', '香油', '辣椒油', '盐'],
    steps: ['黄瓜拍碎切段', '拌入调料腌 5 分钟'],
    note: '开胃凉菜'
  },
  {
    name: '红豆薏米粥',
    category: 'dessert',
    score: 4,
    spicy: 0,
    ingredients: ['红豆 50g', '薏米 50g', '大米 30g', '冰糖可选'],
    steps: ['红豆薏米提前泡', '加水煮开转小火 40 分钟', '加米再煮软'],
    note: '早餐或夜宵'
  }
];

/**
 * 写入 10 道测试家常菜（挂到「自做/家庭」）
 * 同名直接过滤，不弹单条失败、不改名强插
 * @returns {{ added: number, skipped: number, names: string[] }}
 */
function seedTestHomemade() {
  const { place } = seed.ensureHomemadePlace();
  cache.ensure();

  let added = 0;
  let skipped = 0;
  const names = [];

  HOMEMADE_SAMPLES.forEach((sample) => {
    // skipIfDuplicate：同名静默跳过，不抛错、不提示
    const row = dish.save({
      kind: DISH_KIND.HOMEMADE,
      placeId: place.id,
      name: sample.name,
      category: sample.category,
      score: sample.score,
      spicy: sample.spicy,
      tasteTags: [],
      note: sample.note || '',
      ingredients: sample.ingredients || [],
      steps: sample.steps || [],
      images: [],
      videoUrl: '',
      skipIfDuplicate: true
    });
    if (!row) {
      skipped += 1;
      return;
    }
    added += 1;
    names.push(sample.name);
  });

  return { added, skipped, names };
}

function listSampleNames() {
  return HOMEMADE_SAMPLES.map((s) => s.name);
}

module.exports = {
  HOMEMADE_SAMPLES,
  seedTestHomemade,
  listSampleNames
};
