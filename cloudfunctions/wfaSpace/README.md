# wfaSpace 云函数（家庭空间 P1）

## 部署

1. 微信开发者工具打开 `D:\Habby\food`，开通**云开发**并创建环境。
2. 将环境 ID 填入 `miniprogram/config/cloud.js` 的 `envId`。
3. 在云开发控制台（或工具「云函数」）右键 `wfaSpace` → **上传并部署：云端安装依赖**。
4. 集合 `users` / `spaces` / `space_members`：云函数启动时会 `createCollection`；若仍报 **-502005**，请在控制台「数据库」手动新建同名三个集合（权限建议「所有用户可读，仅管理端可写」或「仅创建者及管理员可读写」——业务写操作在云函数内完成）。

## 权限建议（控制台安全规则）

业务写库应仅通过本云函数；集合对客户端 **拒绝所有** 或仅读自己 user 文档（按你们安全策略调整）。P1 若用默认宽松规则，务必在上线前收紧。

## actions

| action | 说明 |
|--------|------|
| login | 确保用户、返回会话 |
| create | 创建空间（主号） |
| join | 邀请码加入 |
| get | 刷新会话与成员 |
| leave | 成员退出（主号禁止） |
| transfer | 转让主号 |
| kick | 踢人 |
| dissolve | 解散 |
| cartGet / cartSet / cartAdd / cartRemove / cartClear | 家庭共享当前点餐 |
| syncPull | 拉取菜单/点餐/心愿 |
| syncUpsert / syncPushBatch | 推送实体（软删墓碑） |

每人同时 `currentSpaceId` 仅一个；空间最多 5 人。

集合：

- `space_carts`：共享购物车  
- `space_docs`：业务实体（type + entityId）  

**注意**：菜品/心愿**图片文件**不同步，仅文字结构。
