# 变更：引入页面系统

## 原因

当前仓库只有单个 `ComposeDocument v5`，`core` 中不存在 page/scene/route 概念，`assets` 的
`ComposeAssetEntry.kind` 是封闭的 `'folder' | 'file'`，`asset-browser` 的上下文菜单与条目呈现全部
硬编码。实施工程师因此无法在一个工程内搭建多个页面，也无法指定首页。

本变更让页面成为一等文档：可创建、可编辑、可保存、有唯一首页、可只读查看其 JSON。把页面当作
属性值装进组件的能力由后续变更 `add-page-node-property` 承担。

## 变更内容

- `core` 新增页面协议：`*.page.json` 文件约定、`app.json` 应用清单与首页指向、
  `ComposePageReference` 页面引用值、`ComposePageDocumentLoader` 加载端口类型，以及循环引用与
  嵌套深度护栏的纯函数。`ComposeDocument.schemaVersion` 保持 5，不引入多文档协议。
- 新增包 `@compose-ui/pages`：无 React、无 DOM 的页面目录扫描、页面文档 Store（含乐观并发与
  文档缓存）、应用清单读写与默认文档 Loader，只依赖 `core` 与 `assets`。
- `asset-browser` 新增两个通用扩展插槽 —— 宿主上下文菜单项与条目标记 —— 以及只读预览模式。
  资源浏览器仍不认识「页面」语义。
- `editor` 新增页面工作区：右键创建页面、双击打开页面标签（每页面一个 `TransactionRuntime`）、
  右键设为首页（文件树与目录网格双处标记）、右键以只读 Monaco 查看页面 JSON；整个工作区跟随
  活动页面标签。
- 修复既有缺陷：`useComposeEditorController` 在 `runtime` prop 变化时不重置会话状态，会残留指向
  上一份文档的选择与视口。

无 **BREAKING** 变更：所有新增 prop 均为可选，省略时既有行为完全不变。

## 影响

- 受影响的规范：`compose-document`、`pages`（新能力）、`asset-browser`、`editor-workspace-layout`
- 受影响的代码：
  - 新增 `packages/core/src/page/`、`packages/pages/`、`packages/editor/src/pages/`
  - `packages/asset-browser/src/asset-browser/compose-asset-browser.tsx`（先拆出上下文菜单与
    命名对话框状态机）、`asset-browser-types.ts`、`script-editor.tsx`、`asset-preview.tsx`
  - `packages/editor/src/compose-editor/compose-editor.tsx`、
    `workspace-layout/{workspace-context,workspace-layout,workspace-panels,workspace-tab}.tsx`、
    `editor-controller/controller.tsx`、`editor-i18n.ts`
  - `app/src/StageDemo.tsx`、`app/src/demo-asset-provider.ts`
  - 文档与配置：`AGENTS.md`（`@compose-ui/pages` 架构边界）、`openspec/project.md`、`README.md`、
    根 `package.json` 的 `pack:dry-run`、`.changeset/`
- 后续变更：`add-page-node-property` 依赖本变更交付的页面协议与页面 Store
