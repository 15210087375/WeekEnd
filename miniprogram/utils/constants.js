const SCHEMA_VERSION = 2;

const STORAGE_KEYS = {
  meta: 'wfa:meta',
  regions: 'wfa:regions',
  malls: 'wfa:malls',
  places: 'wfa:places',
  dishes: 'wfa:dishes',
  orders: 'wfa:orders',
  wishes: 'wfa:wishes',
  /** 家庭空间会话（仅本机缓存，非业务主数据） */
  spaceSession: 'wfa:spaceSession',
  /** 当前点餐购物车（旧版，迁移用） */
  currentCart: 'wfa:currentCart',
  /** 当前正在编辑的预点餐订单 id */
  activeOrderId: 'wfa:activeOrderId'
};

/** 点餐订单状态 */
const ORDER_STATUS = {
  PREORDER: 'preorder',
  COOKING: 'cooking',
  DINED: 'dined',
  ABANDONED: 'abandoned'
};

const ORDER_STATUS_LABELS = {
  preorder: '预点餐',
  cooking: '制作中',
  dined: '已就餐',
  abandoned: '已放弃'
};

/** 餐次 */
const MEAL_SLOT = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  NIGHT: 'night',
  EXTRA: 'extra'
};

const MEAL_SLOT_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  night: '夜宵',
  extra: '加餐'
};

const MEAL_SLOT_OPTIONS = [
  { id: 'breakfast', name: '早餐' },
  { id: 'lunch', name: '午餐' },
  { id: 'dinner', name: '晚餐' },
  { id: 'night', name: '夜宵' },
  { id: 'extra', name: '加餐' }
];

/** 家庭成员身份标签（单选） */
const MEMBER_TAG = {
  EATER: 'eater',
  COOK: 'cook'
};

const MEMBER_TAG_LABELS = {
  eater: '我会吃',
  cook: '我会做'
};

const MEMBER_TAG_OPTIONS = [
  { id: 'eater', name: '我会吃', desc: '顾客：点菜、加单' },
  { id: 'cook', name: '我会做', desc: '厨师：点菜并制作/结单' }
];

/** 文件存档模块 */
const BACKUP_MODULES = {
  MENU: 'menu',
  ORDERS: 'orders',
  WISHES: 'wishes',
  ALL: 'all'
};

const BACKUP_MODULE_META = [
  { id: 'menu', name: '菜单', desc: '区域 / 商场 / 门店 / 菜品与图片' },
  { id: 'orders', name: '点餐', desc: '点餐记录' },
  { id: 'wishes', name: '心愿单', desc: '心愿与图片' }
];

const DISH_KIND = {
  DINE_OUT: 'dine_out',
  HOMEMADE: 'homemade'
};

/** 心愿状态 */
const WISH_STATUS = {
  WANT: 'want',
  DOING: 'doing',
  DONE: 'done',
  DROP: 'drop'
};

const WISH_STATUS_LABELS = {
  want: '想要',
  doing: '进行中',
  done: '已实现',
  drop: '放弃'
};

/** 列表排序：未完成优先 */
const WISH_STATUS_ORDER = {
  want: 0,
  doing: 1,
  done: 2,
  drop: 3
};

/** 心愿分类预设（存字符串，可自由扩展） */
const WISH_CATEGORIES = [
  { id: 'shopping', name: '购物' },
  { id: 'fashion', name: '穿搭' },
  { id: 'travel', name: '旅行' },
  { id: 'digital', name: '数码' },
  { id: 'other', name: '其他' }
];

const SPICY_LABELS = ['不辣', '微辣', '中辣', '特辣'];

const KIND_LABELS = {
  dine_out: '美食档案',
  homemade: '我的菜谱'
};

const VIRTUAL_HOME_BRAND = '自做/家庭';
const DEFAULT_REGION_NAME = '未分区';

module.exports = {
  SCHEMA_VERSION,
  STORAGE_KEYS,
  BACKUP_MODULES,
  BACKUP_MODULE_META,
  DISH_KIND,
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  MEAL_SLOT,
  MEAL_SLOT_LABELS,
  MEAL_SLOT_OPTIONS,
  MEMBER_TAG,
  MEMBER_TAG_LABELS,
  MEMBER_TAG_OPTIONS,
  WISH_STATUS,
  WISH_STATUS_LABELS,
  WISH_STATUS_ORDER,
  WISH_CATEGORIES,
  SPICY_LABELS,
  KIND_LABELS,
  VIRTUAL_HOME_BRAND,
  DEFAULT_REGION_NAME
};
