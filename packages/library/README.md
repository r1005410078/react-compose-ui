# @compose-ui/library

React 与 DOM 无关的**页面库端口**：首页那一屏要的分类计数、回收站、排序、检索、缩略图与
「用过多少次」。它与 `@compose-ui/assets` 的资源端口是**两个端口**——一个的事实来源是数据库，
另一个是对象存储；两者靠同一个 key 接在一起（`pageKey === assetKey`）。

一个端口答不了两边：`ComposeAssetProvider` 是一棵文件树，「PCS 有 64 个」要遍历整棵树读每个
文件的标签而协议里没有标签，「回收站」要软删而协议里 delete 就是删。反过来，页面库也答不了
用户往资源里放 SVG 符号、DXF 与脚本这件事。

```ts
import type { ComposeLibraryPort } from '@compose-ui/library'

// 一次调用回答整屏：列表、下一页游标与两组 facet。
const { items, nextCursor, facets } = await port.query({
  kind: 'project',
  categories: ['pcs'],   // null 这一档表示未分类
  sort: 'modified-desc',
})

facets.byCategory  // 左栏下段：**摘掉 categories 条件**之后每一类各有多少
facets.byLocation  // 左栏上段：项目 / 模板 / 回收站，只受 search 影响

// 「就用这个」：复制在实现侧完成，同一个事务里给来源 useCount +1。
const created = await port.instantiate?.({ sourcePageKey: items[0].pageKey, title: '南山储能 PCS' })
```

## 边界

- 只依赖 `@compose-ui/core` 与 `@compose-ui/assets`。
- 端口上**没有鉴权参数**：鉴权属于 HTTP 适配器，放进端口会让本地实现凭空多出一个它答不了的参数。
- 失败抛 `ComposeAssetError`，不另起一套同样六档的分类。
- **页面保存不走这里**：那仍是资源端口的 `writeFile` 加 `expectedRevision`。
