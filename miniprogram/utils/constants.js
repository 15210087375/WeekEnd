const SCHEMA_VERSION = 3;

const STORAGE_KEYS = {
  meta: 'wfa:meta',
  regions: 'wfa:regions',
  malls: 'wfa:malls',
  places: 'wfa:places',
  dishes: 'wfa:dishes',
  orders: 'wfa:orders',
  wishes: 'wfa:wishes',
  cinemas: 'wfa:cinemas',
  cinemaHalls: 'wfa:cinemaHalls',
  moviePlans: 'wfa:moviePlans',
  movieLogs: 'wfa:movieLogs',
  shopLogs: 'wfa:shopLogs',
  notes: 'wfa:notes',
  schedules: 'wfa:schedules',
  /** 同步闸时间戳（非业务主数据） */
  syncMeta: 'wfa:syncMeta',
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
  CINEMAS: 'cinemas',
  SHOPS: 'shops',
  NOTES: 'notes',
  SCHEDULES: 'schedules',
  ALL: 'all'
};

const BACKUP_MODULE_META = [
  { id: 'menu', name: '菜单', desc: '区域 / 商场 / 门店 / 菜品与图片' },
  { id: 'orders', name: '点餐', desc: '点餐记录' },
  { id: 'wishes', name: '心愿单', desc: '心愿与图片' },
  { id: 'cinemas', name: '观影', desc: '计划、记录、影院与截图' },
  { id: 'shops', name: '购物', desc: '购物账本与小票' },
  { id: 'notes', name: '随笔', desc: '随手记与图片' },
  { id: 'schedules', name: '日程', desc: '按天安排' }
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
const MOVIE_PLAN_STATUS = {
  WANT: 'want',
  PLANNED: 'planned',
  WATCHED: 'watched',
  DROP: 'drop'
};

const MOVIE_PLAN_STATUS_LABELS = {
  want: '想看',
  planned: '已约',
  watched: '看过',
  drop: '弃了'
};

const MOVIE_PLAN_STATUS_ORDER = {
  planned: 0,
  want: 1,
  watched: 2,
  drop: 3
};

const SHOP_STATUS = {
  PLANNED: 'planned',
  DONE: 'done'
};

const SHOP_STATUS_LABELS = {
  planned: '计划',
  done: '已买'
};

const SHOP_CATEGORIES = [
  { id: 'fashion', name: '服饰' },
  { id: 'daily', name: '日用' },
  { id: 'digital', name: '数码' },
  { id: 'beauty', name: '美妆' },
  { id: 'grocery', name: '超市' },
  { id: 'other', name: '其他' }
];

const SCHEDULE_TYPES = [
  { id: 'none', name: '无' },
  { id: 'watch', name: '观影' },
  { id: 'dine', name: '餐厅' },
  { id: 'cook', name: '做饭' },
  { id: 'shop', name: '购物' },
  { id: 'wish', name: '心愿' },
  { id: 'note', name: '随笔' }
];

/** 会跳到对应业务页，不再另存一条「想做什么」日程 */
const SCHEDULE_LINKED_TYPES = {
  watch: true,
  dine: true,
  cook: true,
  shop: true,
  wish: true,
  note: true
};

const NOTE_TAGS = [
  { id: 'idea', name: '想法' },
  { id: 'link', name: '链接' },
  { id: 'list', name: '清单' },
  { id: 'other', name: '其他' }
];

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
  MOVIE_PLAN_STATUS,
  MOVIE_PLAN_STATUS_LABELS,
  MOVIE_PLAN_STATUS_ORDER,
  WISH_CATEGORIES,
  SHOP_STATUS,
  SHOP_STATUS_LABELS,
  SHOP_CATEGORIES,
  NOTE_TAGS,
  SCHEDULE_TYPES,
  SCHEDULE_LINKED_TYPES,
  SPICY_LABELS,
  KIND_LABELS,
  VIRTUAL_HOME_BRAND,
  DEFAULT_REGION_NAME
};
