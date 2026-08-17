# 架构说明（易改易扩）

> 重构进行中：见 `REFACTOR_PLAN.md`、`FEATURE_INVENTORY.md`、`ORDER_FSM.md`、`CART_API.md`。

## 分层

```
pages/          页面：薄编排与导航
components/     UI 组件（如 cart-sheet 半屏购物车）
  ↓
presenters/     展示适配：实体 → 列表 item
config/         分区配置 + 路由表
  ↓
domain/         业务领域：状态机 / CRUD / 同步 / 备份
  ↓
services/       基础设施：LocalStore、ImageStore、Cloud
```

## 点餐

- 订单状态机：`order.transition` / `docs/ORDER_FSM.md`
- 购物车命令：`domain/cart.js` / `docs/CART_API.md`
- 半屏 UI：`components/cart-sheet`（独占 setData）
- 同步推荐入口：`domain.syncRefresh`


| 目录 | 职责 | 扩展时 |
|------|------|--------|
| `config/modules.js` | 美食档案 / 我的菜谱 产品分区 | 新业务线加配置项 |
| `config/routes.js` | 所有 path 与跳转 | 改路径只改这里 |
| `domain/*` | 按实体拆分 | 新实体加文件，在 `domain/index` 挂载 |
| `presenters/*` | 列表/详情展示字段 | 页面不重复拼 subLine |
| `services/*` | 存储与文件 | 可换 CloudStore |
| `pages/*` | UI | 尽量薄 |

## 功能分区

| 产品名 | kind | 主数据 |
|--------|------|--------|
| 美食档案 | `dine_out` | 门店树 + 评分/辣度/口味 |
| 我的菜谱 | `homemade` | 用料/步骤/视频 |

字段裁剪在 `domain/dish.js` 的 `applyModuleFields`，与 `config/modules.js` 的 `form` 展示配置对应。

## 兼容

- `services/repository.js` → 转发 `domain/index`，旧 `require` 仍可用。
- 新代码请：`require('../../domain/index')` + `config/routes` + `presenters/*`。

## 家庭空间（规划）

多人协作见 **`docs/FAMILY_SPACE_PLAN.md`**（已锁定决策）：

- 默认 **仅本机**；可选加入 **唯一** 家庭云空间（云开发）
- 本地 + 文件备份能力保留；CloudSync 为 domain 下可选层

## 修改指南（简）

1. **改文案/入口名**：`config/modules.js`
2. **改跳转路径**：`config/routes.js` + `app.json`
3. **改字段规则**：`domain/dish.js` + `docs/DATA_MODEL.md`
4. **改列表展示**：`presenters/dishItem.js`
5. **改备份格式**：`domain/backup.js`（升 version）

## 禁止

- 页面直接 `wx.setStorage`
- 页面硬编码 `/pages/xxx`（应走 routes）
- 在多个列表页复制 enrich 逻辑
