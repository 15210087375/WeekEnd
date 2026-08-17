# 购物车 API（整理目标）

数据真相：当前可编辑订单 = `preorder | cooking` 之一，id 存 `activeOrderId`。

## 查询

| 方法 | 说明 |
|------|------|
| `snapshot()` | 半屏/角标用视图包 |
| `count()` / `has` / `getDishIds` / `listItems` | 轻量查询 |
| `getActiveOrder` / `listOpenOrders` / `listPreorders` | 订单切换 |
| `isSharedMode()` | 是否家庭共享车 |

## 命令

| 方法 | 说明 |
|------|------|
| `ensureActivePreorder` | 保证有可编辑单 |
| `createPreorder` | 新单 |
| `switchOrder` | 切换进行中单 |
| `add` / `remove` / `toggle` | 改菜；空车 remove→abandon |
| `placeOrder` | 下单确认并家庭 flush |
| `setActiveSchedule` / `setActiveMealDate` | 日程 |
| `markCooking` / `settle` / `abandon` | 状态机 |
| `createShareOrder` | 本地分享快照 |
| `pull` / `push` | 家庭同步 |

## 兼容/待收敛

| 方法 | 说明 |
|------|------|
| `checkout` | 历史别名 → 应指向 settle 或废弃 |
| `clear` | 与 abandon 关系需在代码中统一文档 |

## 页面禁止

- 组合调用 `syncPull` + `cartPull` 多入口写 UI  
- 在 home onShow 直接改半屏 list 字段（阶段 3 后）
