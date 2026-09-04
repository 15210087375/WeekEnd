# 同步与缓存闸（定稿）

先本地、少拉网、成功才记时间、指纹一致不刷 UI。  
未入家庭：永不拉网。

## 桶

| 桶 | 实体 | CD |
|----|------|-----|
| `menu` | region / mall / place / dish | 3 分钟。搜索共用，不单独拉 |
| `fun` | wish + 观影整包 + shopLog + **note** | 3 分钟。观影内部三页签不拉网 |
| `order` | order | 除外：15 秒。启动全量不含点餐 |

观影三个页签是同一 `fun` 快照上的视图。

## 闸

| 场景 | 行为 |
|------|------|
| 启动 `reason=launch` | 拉 `menu+fun`；距上次**成功**启动拉 < 1 分钟则跳过 |
| 启动成功 | 同时写 `launchAt` 与 menu/fun 的 lastSuccess |
| 回前台 | 不算再启动；只走当前 Tab 的桶 CD |
| 进美食 | 先画本地；`order` + `menu` 各自过闸才拉；**仅 `changed` 时**刷新角标/条数 |
| 进娱乐 | 先画本地；`fun` 过闸才拉。刚启动拉过则跳过 |
| 进搜索 | 跟 `menu`，不另开桶 |
| 进我的 | 不自动拉；「同步家庭」、加入/创建 **force 绕过 CD** |
| 拉失败 | **不**推进时间戳 |
| 时间戳 | 落盘 `wfa:syncMeta` |
| 本地写入 | 立刻入队推送，**不受 CD** |
| 备份导入 | `stampAllNow`，短期内不拉网冲掉导入 |
| 图片 | 不同步原图；共享记录只推第 1 张压缩封面 `fileId`；私密不上云；合并时本地 `localPath` 与远端 `fileId` 合并 |

## 合并与 UI

- 按 `id` + `updatedAt` 合并，禁止整表覆盖；墓碑规则同现网。
- 拉完比指纹：`type:count:id:updatedAt…`。一样：不 persist、页面不 setData。
- 不一样：一次写入，禁止先清空再填。

## 页面约定

只调 `domain.syncRefresh({ reason, buckets, force })`。  
禁止页面自己 `syncPull` + `cartPull` 组合。
