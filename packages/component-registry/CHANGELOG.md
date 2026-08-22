# @compose-ui/component-registry

## 1.0.0

### Major Changes

- 6fe5cd6: 发布 vNext React API：第一方视觉组件统一为 Compose 命名、移除 legacy React facade，并以功能目录和
  Storybook 组件文档作为稳定维护边界。资源浏览器的文件预览改为显式打开的 Canvas Dockview 文档标签，
  避免单击资源时读取内容或替换当前目录网格。

  同一 vNext 发布还将 ComposeDocument 升级至 v5：背景从字符串颜色改为结构化 Paint，新增透明度、
  线性/径向/角向渐变、会话颜色历史、吸管与 Stage 直接渐变编辑；受影响的 Core、Editor、Preview、
  Stage、组件注册和物料包均随该 major 变更发布。

### Minor Changes

- 749deb2: Add stable asset references and resolvers, Image/SVG materials, and atomic Asset Browser to Stage drag-and-drop.
- 5fd9605: Add versioned page aggregates, the headless page setup runtime, value and event-method
  Renderer Prop Contracts, persisted page bindings, Editor setup workflows, and isolated
  Stage, Preview, and Page Slot script scopes.
- a40bc1f: Make Auto Layout opt-in for free containers, add generic missing-component Inspector actions,
  support atomic layout enable/remove commands, and replace the layout controls with compact
  conditional sizing, unified gap, and an editable box-model preview. Merge Transform and LayoutItem
  into a compact basic geometry Inspector, aggregate embedded search visibility, and add a reusable
  angle input with a normalized dial and shortcut values. Expose position/alignment, rotation, and
  size as distinct property types, and expose each axis as one editable combobox: numeric values imply
  Fixed while focus reveals English Fill/Hug suggestions that can also be typed directly.
  Move padding into a separate edge editor shared with margin, present it with the same vertical
  label/CSS/editor structure as other Auto Layout fields, preserve the compact three-row Flex grid,
  and reduce the read-only preview to three nodes with explicit main/cross-axis guidance.
  Add a compact expandable empty-layout guide, let a repeated non-default Flex choice restore its
  explicit CSS initial-equivalent value, and flatten the preview nodes with lower visual contrast.
- 8349817: Add Hug content sizing, disposable Renderer measurement adapters, precise asynchronous invalidation, and built-in Text, Image, SVG, and Page Slot intrinsic measurement.
- 53d166b: 升级为严格 ComposeDocument v6，以 Yoga LayoutSnapshot 统一驱动 Stage 与 Preview，并提供显式
  v5→v6 迁移器、LayoutItem/GeometryConstraints、Flex Auto Layout 和嵌套页面布局运行时。
- 7769c06: Add the `node` base property editor so a property can reference a page: pick from a filterable
  candidate list or drop a page from the asset browser. Referenced pages render live on the editing
  canvas and in preview through the new `page-slot` material, which owns the loading state machine
  so neither Stage nor Preview needs its own. Adds a stable asset reference drag payload, the
  `nodeEditPort` / `pageDocumentPort` registry ports, and `createComposePageDocumentLoader`.
- 43d5e62: 页面之间改为跳转关系，不再支持嵌套。

  新增可选的 `Interaction` Entity Component（v1 只有 `click` trigger 与 `navigate` /
  `navigate-back` 两种 action，可挂在任意 Entity 上），`core` 的 `ComposeNavigationPort`
  协议、`pages` 的导航会话实现，以及 `preview` 的 `ComposePageHost`。页面脚本另有
  `ctx.navigate` / `ctx.navigateBack` 作为条件跳转的逃生舱。编辑期不跳转：Stage 的命中
  测试与手势完全不受 `Interaction` 影响。

  **BREAKING**：删除 Page Slot 物料、Renderer、Preset 与资源拖入创建路径；删除 `core`
  基于祖先页面链与深度上限的嵌套护栏（`COMPOSE_PAGE_NEST_DEPTH_LIMIT`、
  `resolveComposePageNestState`、`ComposePageNestState`）。复用一块 UI 改用 Component
  Asset v2 与 Variant。不提供迁移器——残留的 `page-slot` Entity 落到 Registry 既有的
  「未知 Renderer」占位上，几何与外观保留。

  **BREAKING**：删除只为 Page Slot 存在的 `pageDocumentPort` 渲染上下文端口，以及
  `stage` 与 `editor` 的 `pageLoader` 选项。`preview` 的 `pageLoader` 保留，但只服务导航。

  **BREAKING**：删除弃用别名 `ComposePageDocumentLoader` 与
  `createComposePageDocumentLoader`，改用 `ComposePageLoader` / `createComposePageLoader`。

- 57a82d6: Add the versioned JSON compose document, atomic reversible command transaction runtime,
  built-in editing commands, structured CommandPanel, component registry, infinite DOM/SVG
  Stage, document Preview, and controller-driven editor composition.
- dc66e03: Add universal node styles, Frame palette presets, shared Stage/Preview visual rendering,
  container inspection, and an instance-scoped Frame, Rectangle, and Text materials bundle.

### Patch Changes

- Updated dependencies [749deb2]
- Updated dependencies [5fd9605]
- Updated dependencies [f0ba0a5]
- Updated dependencies [3f2fbf9]
- Updated dependencies [8349817]
- Updated dependencies [749deb2]
- Updated dependencies [8e8afbb]
- Updated dependencies [53d166b]
- Updated dependencies [bc2e0a4]
- Updated dependencies [7769c06]
- Updated dependencies [43d5e62]
- Updated dependencies [d922b24]
- Updated dependencies [57a82d6]
- Updated dependencies [2f17288]
- Updated dependencies [6a3b60a]
- Updated dependencies [f0b8c05]
- Updated dependencies [6fe5cd6]
- Updated dependencies [dc66e03]
  - @compose-ui/assets@0.2.0
  - @compose-ui/core@1.0.0
  - @compose-ui/script-runtime@0.2.0
