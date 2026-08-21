/**
 * 全库搜索「功能入口」。新增模块在此登记即可被搜到。
 */
module.exports = [
  {
    id: 'wish',
    title: '心愿单',
    sub: '想买、想做的目标',
    keywords: ['心愿', '心愿单', '愿望'],
    go: { kind: 'wishList' }
  },
  {
    id: 'shop',
    title: '购物',
    sub: '记账与购物计划',
    keywords: ['购物', '买东西', '账单'],
    go: { kind: 'shopList' }
  },
  {
    id: 'watch',
    title: '观影',
    sub: '片子、影院与记录',
    keywords: ['观影', '电影', '影院', '片子'],
    go: { kind: 'watch', tab: 'plan' }
  },
  {
    id: 'note',
    title: '随笔',
    sub: '随手记',
    keywords: ['随笔', '日记', '笔记'],
    go: { kind: 'noteList' }
  },
  {
    id: 'schedule',
    title: '日程',
    sub: '当天安排与待办',
    keywords: ['日程', '日历', '行程'],
    go: { kind: 'scheduleDay' }
  },
  {
    id: 'dine_out',
    title: '美食档案',
    sub: '外出就餐记录',
    keywords: ['美食档案', '外出', '档案'],
    go: { kind: 'archiveList', dishKind: 'dine_out' }
  },
  {
    id: 'homemade',
    title: '我的菜谱',
    sub: '自己做的菜',
    keywords: ['菜谱', '我的菜谱', '自做'],
    go: { kind: 'archiveList', dishKind: 'homemade' }
  },
  {
    id: 'order',
    title: '点餐',
    sub: '当前点餐与往期',
    keywords: ['点餐', '想吃', '订单'],
    go: { kind: 'orderList' }
  }
];
