# 订单状态机（Order FSM）

## 状态

| id | 中文 | 是否在购物车 |
|----|------|----------------|
| `preorder` | 预点餐 | 是 |
| `cooking` | 制作中 | 是 |
| `dined` | 已就餐 | 否 |
| `abandoned` | 已放弃 | 否 |

## 合法迁移

```
(create allowEmpty) → preorder
preorder → cooking     // markCooking
preorder → dined       // settle（可跳过制作中）
cooking  → dined       // settle
```


**放弃（现行实现）：** `cart.abandon` **删除**订单记录（不进往期），并切换 active。  
语义上等同终端态，**不是**写入 `status=abandoned` 残留列表（与早期「abandoned 状态」文档差异以代码为准）。

非法示例：`dined → cooking`、`dined → preorder`（应新建单）。

## 命令映射（domain）

| 用户意图 | API |
|----------|-----|
| 制作中 | `cart.markCooking` → `order.transition(..., cooking)` |
| 已就餐 | `cart.settle` → `order.transition(..., dined)` |
| 放弃 | `cart.abandon` → `order.remove` + 重选 active |
| 材料清单 | `order.collectMaterials`（只读） |

## 实现约束

- 迁移函数集中在 `domain/order.js`（`assertTransition` / `transition`）。
- 页面不得直接改 `order.status` 字符串拼凑。
- 购物车 active 仅指向 `preorder|cooking`。
