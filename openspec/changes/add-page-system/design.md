## 上下文

页面系统的第一阶段要让页面成为一等文档（创建、编辑、保存、首页、只读查看 JSON），横跨 `core`、
`assets`、`asset-browser`、`editor` 四个包。AGENTS.md 的架构边界是硬约束，其中两条直接决定了本
设计的形状：

- `asset-browser` 不得依赖 `core`，因此**不可能**知道 `*.page.json` 是什么。
- `editor` 与 `preview` 不得互相引用，因此页面文档的加载实现不能只存在于 `editor` 内部。

## 目标 / 非目标

- 目标：页面以 `*.page.json` 资源文件持久化，内容就是一份未改动的 `ComposeDocument v5`。
- 目标：首页有唯一事实来源，且在只读 Provider、清单缺失、清单损坏、key 悬空四种情况下行为确定。
- 目标：所有新增 API 可选，省略时既有行为逐字节不变。
- 非目标：不引入 `ApplicationDocument` 多文档协议，不改 `schemaVersion`。
- 非目标：不做页面路由、页面间跳转、页面级权限。
- 非目标：不做把页面当作属性值的 `node` editor 与嵌套渲染 —— 那是 `add-page-node-property`。
  本变更只在 `core` 中先落定该后续变更所需的引用值与嵌套护栏协议，以免届时改动已发布的文档协议。

## 决策

### 决策 1：页面协议放 `core`，页面 Store 放新包 `@compose-ui/pages`

页面的文件名约定、清单 Schema、引用值形状、循环/深度不变量都是确定性的、无框架的文档语义 ——
正是 `core` 的职责（layer 1，无 React/DOM）。而「递归扫描 Provider、缓存文档、乐观并发写入」
是需要 `assets` 端口的实现，`core` 不得依赖 `assets`。

`ComposePageDocumentLoader` 定义在 `core` 且是纯类型，因此后续 `stage` 与 `preview` 接受该端口时
**不产生任何新的包依赖**。

**替代方案：Store 放 `editor` 内部。** 被否决 —— 独立 `preview` 与发布后的运行时也必须能加载页面
文档，而 `preview` 不得依赖 `editor`，那会迫使每个宿主自己手写一份 Loader。

**替代方案：Store 放 `component-registry`。** 被否决 —— registry 是实例级宿主组件注册协议，页面
Store 不属于该职责（范畴错误）。

AGENTS.md「架构边界」需新增一条：

> `@compose-ui/pages` 是无 React、无 DOM 的页面清单、页面目录与页面文档 Store 包，只能依赖
> `core` 和 `assets`；不得依赖任何 React chrome、`asset-browser`、`editor`、`preview` 或 `stage`。

### 决策 2：`asset-browser` 保持通用，页面语义由 `editor` 注入

`asset-browser` 不得依赖 `core`，所以扩展插槽全部以「不含领域词汇」的形式定义：`contextMenuItems`
（宿主菜单项，追加在内建 4 项之后）与 `renderEntryBadge`（首页星标由 `editor` 提供）。
`ComposeAssetContextMenuContext` 提供 `promptName()` 与 `refresh()`，让宿主复用浏览器内建的命名
对话框与 `validateAssetName`，而不暴露任何 React 事件对象。

本变更**不**引入 `renderEntryIcon`：页面文件仍用默认文件图标，首页用标记表达，没有真实消费者的
插槽按 AGENTS.md「不得以未来可能复用为理由提前抽象」不予添加。

**替代方案：教 `asset-browser` 认识页面。** 被否决 —— 需要 import `core`（边界禁止），且把文档
语义塞进一个明确以「不含文档语义」为非目标的 Widget。

### 决策 3：会话与运行时归 Editor，活动 runtime 交回宿主

Editor 拥有页面会话表与每个已打开页面的 `TransactionRuntime`，并通过
`pages.onActiveSessionChange` 把活动页面的运行时交回宿主；宿主据此切换传给
`useComposeEditorController` 的 `runtime`。因为运行时存活在会话表中，**每个页面的 undo 历史在
切标签后保留**（仅 selection/viewport 随文档重置）。

**替代方案：Editor 内部按 pageKey key 化第二个 controller。** 被否决 ——
`useComposeEditorController` 是宿主拥有的 prop，Editor 私自再造一个 controller 就出现两个事实
来源；而且要拿到子组件里的 hook 结果，必须把 `compose-editor.tsx` 的渲染树倒置成
children-as-function，改动面远大于收益。

这一选择使下面的缺陷修复成为**必需项**而不是可选优化：`useComposeEditorController` 的会话状态
（`selectedIds`、`inspectionTarget`、`expandedIds`、`viewport`、`paintEditing`、`paintSampling`）
全部用 `useState` 初始化器建立，换 `runtime` prop 时**不会**重置，会残留指向上一份文档的选择与
视口。以「prop 变化时在渲染期调整 state」的标准模式重置，并同时取消进行中的 Pointer 与外部
拖入手势（两条独立的进行中状态）。

副作用：`runtime` prop 必须保持稳定引用。在渲染函数里新建 `TransactionRuntime` 本来就是误用
（每次渲染丢失全部历史），修复后会直接表现为无限重渲染而不是静默错误。

### 决策 4：Stage 只能有一个宿主面板

`WorkspaceContent.stageHostPanelId` 显式指定唯一允许渲染 Stage 的面板：活动页面标签优先，
否则回落到固定画布面板。

原因是实测发现的：Dockview **会保留同组内非活动面板的挂载**，因此不能依赖「只有活动面板才
渲染」。一旦画布面板与页面面板同时渲染 Stage，第二次 `connectSurface` 就会抛
「already has a connected surface」并让整个 React 树崩溃 —— 表现为资源网格变空、标签消失，
而不是一个局部错误。这个问题只在真实 Dockview 下出现，测试替身按「只渲染活动面板」实现时
无法复现。

### 决策 5：首页事实来源是资源根 `app.json`

`{ schemaVersion: 1, homePageKey: string | null }`。写在清单而不是各页面自带 `isHome`，因为后者
设首页需同时写两个文件，且存在「多首页 / 无首页」的不一致状态需要修复逻辑。
`parseComposeAppManifest` 保留未知顶层字段并在序列化时写回，避免设首页覆盖宿主自有的清单数据。

## 风险 / 权衡

- **`compose-asset-browser.tsx` 已 852 行**，不先拆就加插槽会违反「复杂交互不得全部堆在一个 TSX
  文件」→ 在 P1 内先以独立的纯重构提交抽出 `asset-context-menu.tsx` 与 `use-name-prompt.ts`，
  再往干净的接缝上加插槽。
- **新包开销**（build/dts/turbo/changeset/architecture 脚本/AGENTS.md 修订）→ 保持「小而依赖极少」。
- **换 runtime 会重置 selection/viewport** → 接受并记 TODO；替代方案（把会话状态按 pageKey 提升
  到 editor）是更大的 controller 重构。
- **`pages` 配置与 `runtime` prop 必须保持稳定引用** → Editor 侧只按「是否启用」、宿主 Store 与
  Provider 派生页面 Store，避免行内对象字面量导致 Store 反复重建；宿主侧在文档与 README 中说明。
- **双写者的乐观并发**（页面标签 + 只读 JSON 标签 + 外部编辑）→ `expectedRevision` + 显式覆盖
  确认；Store 必须在 `provider.subscribe` 事件上失效缓存，否则陈旧 `baseRevision` 会造成假冲突。

## 迁移计划

纯增量，无数据迁移：现有单文档宿主不传 `pages` 即完全不受影响。分三个阶段推进，每阶段可独立
验证（见 `tasks.md`）；P1 交付一条可运行的纵向流程（创建 → 打开 → 编辑 → 保存）后再扩展首页与
只读查看。回滚以阶段为单位。

## 待解决问题

- 切标签时 selection/viewport 重置是否需要在后续变更中改为按页面保留（决策 3 的已知限制）。
- 页面标签与固定画布面板长期是否应合并为同一个「编辑表面」概念，从而不再需要
  `stageHostPanelId` 这样的协调字段（决策 4 的权衡）。
