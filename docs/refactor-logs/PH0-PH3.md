# 重构日志 PH0–PH3（进行中）

## 阶段 0–1 文档

- [x] FEATURE_INVENTORY.md
- [x] REFACTOR_PLAN.md（三轮核验修正）
- [x] ORDER_FSM.md / CART_API.md
- [x] ARCHITECTURE 指向新文档

## 阶段 2 domain

- [x] `order.canTransition` / `order.transition`
- [x] cart.markCooking / settle 走 transition
- [x] `sync.refresh` + `domain.syncRefresh`
- [ ] 手工：制作中 / 已就餐 / 非法迁移（待真机）

## 阶段 3 cart-sheet

- [x] `components/cart-sheet` 组件
- [x] home 变薄：仅入口 + FAB + open
- [x] 删除 home 内 force/签名/半屏字段 setData 补丁链
- [ ] 手工：开半屏 10 次无连闪；F3 主路径（待真机）

## 自测命令（自动化部分）

```
node -c miniprogram/domain/order.js
node -c miniprogram/domain/cart.js
node -c miniprogram/components/cart-sheet/index.js
node -c miniprogram/pages/home/index.js
```
