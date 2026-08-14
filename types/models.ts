/**
 * 周末美食档案 — 数据模型类型 v1
 * 与 docs/DATA_MODEL.md 一一对应；schemaVersion = 1
 */

export type RecordSource = 'local' | 'cloud';

export type DishKind = 'dine_out' | 'homemade';

/** 0 不辣 → 3 特辣 */
export type SpicyLevel = 0 | 1 | 2 | 3;

export interface BaseRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  source: RecordSource;
}

export interface ImageRef {
  localPath: string;
  remoteUrl?: string;
  fileId?: string;
}

export interface Region extends BaseRecord {
  name: string;
  sort: number;
}

export interface Mall extends BaseRecord {
  regionId: string;
  name: string;
  sort: number;
}

export interface Place extends BaseRecord {
  regionId: string;
  mallId: string | null;
  brandName: string;
  storeName: string;
  address: string;
  navUrl: string;
  note: string;
  isVirtual: boolean;
}

export interface Dish extends BaseRecord {
  placeId: string;
  kind: DishKind;
  name: string;
  score: number | null;
  tasteTags: string[];
  spicy: SpicyLevel | null;
  note: string;
  images: ImageRef[];
  steps: string[];
  ingredients: string[];
  videoUrl: string;
}

/** 心愿状态 */
export type WishStatus = 'want' | 'doing' | 'done' | 'drop';

/** 心愿单（娱乐域，任意想要/想做） */
export interface Wish extends BaseRecord {
  title: string;
  category: string;
  status: WishStatus;
  note: string;
  priceRef: number | null;
  images: ImageRef[];
}

/** LocalStore 根形状（逻辑）；物理 key 见 DATA_MODEL §4 */
export interface AppData {
  schemaVersion: number;
  regions: Region[];
  malls: Mall[];
  places: Place[];
  dishes: Dish[];
  orders?: unknown[];
  wishes: Wish[];
}

export const SCHEMA_VERSION = 2 as const;

export interface StorageMeta {
  schemaVersion: number;
  updatedAt: number;
}

/** Storage key 常量 */
export const STORAGE_KEYS = {
  meta: 'wfa:meta',
  regions: 'wfa:regions',
  malls: 'wfa:malls',
  places: 'wfa:places',
  dishes: 'wfa:dishes',
  orders: 'wfa:orders',
  wishes: 'wfa:wishes',
} as const;

export interface ExportImageItem {
  dishId?: string;
  wishId?: string;
  index: number;
  fileName: string;
  base64: string;
}

export interface ExportPackage {
  format: 'weekend-food-archive';
  version: 2;
  exportedAt: number;
  data: {
    regions: Region[];
    malls: Mall[];
    places: Place[];
    dishes: Dish[];
    orders?: unknown[];
    wishes?: Wish[];
  };
  images: ExportImageItem[];
}

/** 新建时可由工厂填充的默认值（不含 id/时间戳） */
export type RegionInput = Pick<Region, 'name'> & Partial<Pick<Region, 'sort'>>;
export type MallInput = Pick<Mall, 'regionId' | 'name'> & Partial<Pick<Mall, 'sort'>>;
export type PlaceInput = Pick<Place, 'regionId' | 'brandName'> &
  Partial<
    Pick<Place, 'mallId' | 'storeName' | 'address' | 'navUrl' | 'note' | 'isVirtual'>
  >;
export type DishInput = Pick<Dish, 'placeId' | 'kind' | 'name'> &
  Partial<
    Pick<
      Dish,
      | 'score'
      | 'tasteTags'
      | 'spicy'
      | 'note'
      | 'images'
      | 'steps'
      | 'ingredients'
      | 'videoUrl'
    >
  >;
