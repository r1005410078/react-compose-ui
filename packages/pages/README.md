# @compose-ui/pages

React 与 DOM 无关的页面目录、页面聚合 Store 与应用清单读写。页面文件包装
`ComposeDocument v6` 与可选 `setupScript` 稳定引用；首页由资源根的 `app.json` 唯一表达。

编辑器与独立预览运行时共用同一 Store，因此页面加载不依赖 `@compose-ui/editor`。

```ts
import { createComposePageStore } from '@compose-ui/pages'

const store = createComposePageStore({ provider })

const { pages, homePageKey, homePageMissing, manifestIssues } = await store.listPages()

const { page, revision } = await store.readPage(pages[0].pageKey)
await store.writePage(pages[0].pageKey, { ...page, document: nextDocument }, revision)
await store.setPageSetupScript(pages[0].pageKey, setupReference, revision)

if (store.canWriteManifest()) await store.setHomePage(pages[0].pageKey)
```

## 边界

- 只能依赖 `@compose-ui/core`（页面协议）与 `@compose-ui/assets`（Provider 端口）。
- 不得依赖任何 React chrome 包、`asset-browser`、`editor`、`preview` 或 `stage`。
- 不导出 React 类型、`HTMLElement` 或浏览器事件对象。

## 语义要点

- **稳定 key**：`ComposePageDescriptor.pageKey` 取自 `ComposeAssetEntry.assetKey`，跨重命名与
  移动不变，可安全写入清单与文档引用。`entryId` 会变化，不得持久化。
- **乐观并发**：`writePage` 传入上次读写得到的 `revision`；冲突以
  `ComposeAssetError`（`code` 为 `conflict`）暴露，由宿主决定是否强制覆盖。
- **清单宽容降级**：`app.json` 缺失、非法 JSON、结构不符或版本不受支持都降级为「无首页」并
  附带 issue，不让资源面板整体不可用。未知顶层字段被保留并在写回时原样输出。
- **首页 key 悬空不自动清空**：只报告 `homePageMissing` —— 一次列举失败或外部临时移动文件
  都不应销毁用户的首页选择。
- **缓存失效**：Provider 通知变更时保守失效全部缓存，避免陈旧 `revision` 造成假冲突。
