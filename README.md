# 周末美食档案（微信小程序）

本地多表 CRUD：外出「美食档案」+ 自做「我的菜谱」。

- 共识：`Documents/weekend-food-archive/COLDSTART.md`
- 数据：`docs/DATA_MODEL.md`
- **架构（改代码必读）**：`docs/ARCHITECTURE.md`
- 页面：`docs/PAGES.md`

## 路径

`D:\Habby\food` — 微信开发者工具打开此目录。

## 分层速查

```
pages/        展示与交互（薄）
config/       业务分区 modules + 路由 routes
presenters/   列表展示适配
domain/       业务 CRUD / 种子 / 备份
services/     Storage / 图片文件
```

## 改什么去哪

| 需求 | 位置 |
|------|------|
| 改分区名/文案/表单块 | `miniprogram/config/modules.js` |
| 改页面 path | `miniprogram/config/routes.js` + `app.json` |
| 改字段/校验 | `domain/dish.js` 等 + DATA_MODEL |
| 改列表展示字段 | `presenters/dishItem.js` |
| 改备份 | `domain/backup.js` |

## 运行

1. 微信开发者工具导入 `D:\Habby\food`
2. 编译预览
