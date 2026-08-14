# 周末美食档案 — 数据模型 v1

> **状态**：v2（2026-08-11）— 增加分类标签、点餐清单  
> **工程根**：`D:\Habby\food`  
> **共识源**：`Documents/weekend-food-archive/COLDSTART.md`（决策不得与之冲突）  
> **类型源码**：`types/models.ts`（与本文件一一对应）

本文件只定义**数据结构、约束与存储形状**；页面/UI 库另文。

---

## 1. 实体关系

```
Region（区域）
  └── Mall（商场/商圈，可选）
        └── Place（品牌/门店）
              └── Dish（菜品 | 菜谱）
```

- 街边店：`Place.mallId = null`，直接挂 `regionId`。
- 同一品牌多门店：多条 `Place`，靠 `mallId` / `storeName` / `address` 区分。
- 自做菜：`Dish.kind = "homemade"`，可挂真实店，或挂虚拟 Place（`isVirtual = true`，如「自做/家庭」）。

---

## 2. 枚举与公共类型

### 2.1 枚举

| 名 | 取值 | 说明 |
|----|------|------|
| `RecordSource` | `"local"` \| `"cloud"` | v1 只写 `"local"` |
| `DishKind` | `"dine_out"` \| `"homemade"` | 外出就餐 / 自做菜谱 |
| `SpicyLevel` | `0` \| `1` \| `2` \| `3` | 0 不辣 → 3 特辣；业务上可空（未填） |
| `WishStatus` | `"want"` \| `"doing"` \| `"done"` \| `"drop"` | 想要 / 进行中 / 已实现 / 放弃 |

### 2.2 公共元数据 `BaseRecord`

每条业务记录均包含：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✓ | 本地生成 UUID（无连字符或标准 UUID 均可，全库统一一种） |
| `createdAt` | `number` | ✓ | Unix ms |
| `updatedAt` | `number` | ✓ | Unix ms；每次 save 刷新 |
| `source` | `RecordSource` | ✓ | v1 固定 `"local"` |

### 2.3 图片引用 `ImageRef`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `localPath` | `string` | ✓ | 用户目录持久路径（禁止长期使用临时路径） |
| `remoteUrl` | `string` | | 云扩展预留 |
| `fileId` | `string` | | 云扩展预留 |

约束：

- **禁止**把图片 base64 写入业务表或 `wx.setStorage` 业务 key。
- 导出包可单独携带图片 payload（见 §7）；导入后再写回文件系统并填 `localPath`。

---

## 3. 实体字段

### 3.1 Region（区域）

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| …BaseRecord | | ✓ | | |
| `name` | `string` | ✓ | | 如「浦东」「静安」；trim 后非空 |
| `sort` | `number` | ✓ | `0` | 升序；同 sort 按 `name` |

### 3.2 Mall（商场）

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| …BaseRecord | | ✓ | | |
| `regionId` | `string` | ✓ | | → Region.id |
| `name` | `string` | ✓ | | trim 非空 |
| `sort` | `number` | ✓ | `0` | |

### 3.3 Place（品牌/门店）

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| …BaseRecord | | ✓ | | |
| `regionId` | `string` | ✓ | | → Region.id |
| `mallId` | `string \| null` | ✓ | `null` | → Mall.id；街边店为 `null` |
| `brandName` | `string` | ✓ | | 品牌名 |
| `storeName` | `string` | | `""` | 分店名/备注 |
| `address` | `string` | | `""` | |
| `navUrl` | `string` | | `""` | 导航外链，只存不解析 |
| `note` | `string` | | `""` | |
| `isVirtual` | `boolean` | ✓ | `false` | `true` = 虚拟挂载点（自做） |

约束：

- 若 `mallId != null`，该 Mall 的 `regionId` 应与 Place.`regionId` 一致（写入时校验或自动纠正为 Mall 的 regionId）。
- 虚拟 Place 建议：`brandName = "自做/家庭"`，`mallId = null`，可挂在任意 Region 或单独「通用」区（实现时种子一条即可）。

### 3.4 Dish（菜品/菜谱）

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| …BaseRecord | | ✓ | | |
| `placeId` | `string` | ✓ | | → Place.id |
| `kind` | `DishKind` | ✓ | | |
| `name` | `string` | ✓ | | trim 非空 |
| `category` | `string` | ✓ | `stir_fry` | 分类 id：`stir_fry`/`bbq`/`hotpot`/`snack`/`drink`/`dessert`（炒菜/烧烤/火锅/小吃/饮品/甜点）；旧 id 读时映射 |
| `score` | `number \| null` | | `null` | 0–5，步进 0.5；`null` = 未评 |
| `tasteTags` | `string[]` | ✓ | `[]` | 口味标签，自由文本 |
| `spicy` | `SpicyLevel \| null` | | `null` | 未填为 `null` |
| `note` | `string` | | `""` | |
| `images` | `ImageRef[]` | ✓ | `[]` | |
| `steps` | `string[]` | ✓ | `[]` | **homemade 主用**；逐步字符串 |
| `ingredients` | `string[]` | ✓ | `[]` | **homemade 主用**；用料字符串列表 |
| `videoUrl` | `string` | | `""` | **抖音完整分享口令**（抖音 App「分享→复制链接」原样粘贴；勿只存裸 URL）。字段名历史遗留，语义=shareText |

约束：

| kind | 字段期望 |
|------|----------|
| `dine_out` | 评分/辣度/标签常用；`steps`/`ingredients`/`videoUrl` 允许空 |
| `homemade` | `steps`/`ingredients`/`videoUrl` 可用；评分/辣度仍可选 |

- `score`：有值时须满足 `0 ≤ score ≤ 5` 且为 `0.5` 的整数倍。
- `images` 建议单菜上限（软限制，实现提示即可）：**≤ 9**。

### 3.5 Wish（心愿单，娱乐域）

与美食树无关的独立实体：任意「想要 / 想做」条目（自行车、衣服、旅行等）。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| …BaseRecord | | ✓ | | |
| `title` | `string` | ✓ | | trim 非空 |
| `category` | `string` | | `""` | 预设：购物/穿搭/旅行/数码/其他；可空 |
| `status` | `WishStatus` | ✓ | `want` | `want` \| `doing` \| `done` \| `drop` |
| `note` | `string` | | `""` | 尺码、型号、链接等 |
| `priceRef` | `number \| null` | | `null` | 参考价；非负 |
| `images` | `ImageRef[]` | ✓ | `[]` | 软上限 **≤ 6** |

列表默认排序：未完成优先（want → doing → done → drop），同档按 `updatedAt` 降序。

---

## 4. 集合与 LocalStore 形状

内存/持久化的根对象：

```ts
interface AppData {
  schemaVersion: number;  // 实现侧常量，见 constants.SCHEMA_VERSION
  regions: Region[];
  malls: Mall[];
  places: Place[];
  dishes: Dish[];
  orders: Order[];   // 点餐清单
  wishes: Wish[];    // 心愿单
}
```

### 4.1 Storage 约定（实现时遵守）

| Key | 内容 | 说明 |
|-----|------|------|
| `wfa:meta` | `{ schemaVersion, updatedAt }` | 小 meta |
| `wfa:regions` | `Region[]` | 拆 key，避免单 key 过大 |
| `wfa:malls` | `Mall[]` | |
| `wfa:places` | `Place[]` | |
| `wfa:dishes` | `Dish[]` | 含 ImageRef 路径，不含 base64 |
| `wfa:orders` | `Order[]` | 点餐 |
| `wfa:wishes` | `Wish[]` | 心愿单 |

- 前缀 `wfa` = weekend-food-archive。
- 页面**禁止**直接 `wx.setStorage`；只经 Repository。
- 单 key 官方常见上限约 1MB；表膨胀后再考虑分片（v1 不必）。

### 4.2 图片文件路径约定

```
${wx.env.USER_DATA_PATH}/images/{ownerId}/{uuid}.jpg
```

（`ownerId` 为 dishId 或 wishId；扩展名随实际格式；路径写入 `ImageRef.localPath`。）

---

## 5. 引用完整性与删除规则

| 操作 | 规则 |
|------|------|
| 删 Region | 若存在 `mall.regionId` 或 `place.regionId` 指向该 id → **禁止** |
| 删 Mall | 若存在 `place.mallId` 指向该 id → **禁止** |
| 删 Place | 若存在 `dish.placeId` 指向该 id → **禁止** |
| 删 Dish | 允许；须同步删除其 `images[].localPath` 文件（能删则删，文件缺失不阻断） |
| 删 Wish | 允许；同步删除其图片文件 |

写入校验（save 时）：

- 外键目标必须存在（`regionId` / `mallId` / `placeId`）。
- `mallId === null` 合法；非 null 时 Mall 必须存在。

---

## 6. 种子数据（首次空库）

| 实体 | 内容 |
|------|------|
| Region | 可选：不强制；也可不建区仅提示用户自建 |
| Place | 一条虚拟：`brandName: "自做/家庭"`, `isVirtual: true`, `mallId: null`；`regionId` 需已有 Region 时再建，或延后到用户首次录自做时创建 |

推荐策略（实现）：

1. 空库不强制 Region。
2. 用户首次保存 `homemade` 且未选店时，确保存在虚拟 Place（若无 Region，先建默认 Region `"未分区"`）。

---

## 7. 导出包形状（数据契约）

```ts
/** 存档模块：可多选；缺省 modules 的旧包视为 ["all"] */
type BackupModule = "menu" | "orders" | "wishes" | "all";

interface ExportPackage {
  format: "weekend-food-archive";
  version: 2; // 分模块时建议升 3，读端须兼容无 modules 的 v2 全量包
  exportedAt: number;
  /** 本包包含的模块；导入时只替换这些模块，其余本机数据不动 */
  modules?: BackupModule[];
  data: {
    regions?: Region[];
    malls?: Mall[];
    places?: Place[];
    dishes?: Dish[];  // images[].localPath 可保留作对照，导入时会重写
    orders?: Order[];
    wishes?: Wish[];
  };
  images: ExportImageItem[]; // 仅含所选模块相关图
}

interface ExportImageItem {
  dishId?: string;    // 菜品图（module menu）
  wishId?: string;    // 心愿图（module wishes）
  index: number;      // 对应实体 images 下标
  fileName: string;
  base64: string;     // 无 data: 前缀的纯 base64
}
```

导入策略：

- 有 `modules`：按模块 **局部替换**（如仅 `wishes` 则不动菜单/点餐）。
- 无 `modules`（旧包）：视为 `all`，**全量替换**已出现的业务表。
- 图片：只处理包内 `images`，并改写对应实体的 `localPath`；执行前二次确认并展示将替换的模块名。

分模块细节与云场景约束见 `FAMILY_SPACE_PLAN.md` §2.7。

---

## 8. 索引与检索（逻辑，非物理表）

Repository 层按内存过滤即可（v1 数据量小）：

| 能力 | 条件 |
|------|------|
| 按区域 | `place.regionId` / 树上钻取 |
| 按商场 | `place.mallId` |
| 按品牌 | `place.brandName` 包含 |
| 按菜名 | `dish.name` 包含 |
| 按 kind | `dish.kind` |
| 按辣度 | `dish.spicy` |
| 按评分 | `dish.score` 区间或 ≥ |
| 按标签 | `dish.tasteTags` 命中 |

---

## 9. 非目标（数据层）

- 用户账号、多人协作字段
- 云同步冲突向量 / CRDT
- 地图坐标字段（v1 只用 `navUrl` 字符串；坐标二期再加）

---

## 10. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-04 | 初版定稿；工程根 `D:\Habby\food` |
| 2026-08-13 | 备份支持文件导入导出（`USER_DATA_PATH/backup/*.json` + 选聊天文件）；剪贴板仅作小数据兜底 |
| 2026-08-13 | 心愿单 Wish：娱乐域独立实体；状态 want/doing/done/drop；备份 `data.wishes` + 图片 `wishId` |
| 2026-08-13 | 家庭空间协作决策锁定：见 `FAMILY_SPACE_PLAN.md`（1 空间、主号、LWW 软删、心愿私密等）；模型字段待 P1 起落地 |
| 2026-08-13 | 备份支持分模块：`modules` = menu / orders / wishes / all；导入局部替换；见 FAMILY_SPACE_PLAN §2.7 |
| 2026-08-13 | 菜品分类改为：炒菜/烧烤/火锅/小吃/饮品/甜点（去掉正餐等） |
