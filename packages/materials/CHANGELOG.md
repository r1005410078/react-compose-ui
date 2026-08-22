# @compose-ui/materials

## 1.0.0

### Major Changes

- 2f17288: Upgrade ComposeDocument to v3 with an implicit Canvas root, arbitrary root Components,
  nested rotatable Frames with selective clipping, fixed document output settings, and
  document or Frame Preview targets.

  Remove the Group node kind, `frame.create`, `activeFrameId`, and the Preview `frameId`
  prop. Group and ungroup user actions now create or dissolve transparent Frame containers,
  while Frame resize changes only the Frame boundary. The default output is transparent with
  a selectable Stage border; Editor exposes a dedicated Canvas Inspector with common desktop
  size presets, custom output fields, and reversible history integration. Output edges use one
  theme-aware neutral color (or the editor accent while selected), keeping the Godot X/Y axis colors
  semantically distinct, with an exact 16×16 dual-fill `EditorPosition` badge marking world `(0,0)`
  over the continuous axes. Low-zoom grids now retain every configured line
  down to 2 CSS pixels, then coalesce only to power-of-two subsets without changing snap geometry.

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
- 6a3b60a: Add a shared theme and i18n Context package, a VS Code-style editor-scoped settings
  dialog, complete first-party dark/light and Chinese/English chrome, configurable
  single-stroke shortcuts, and Space-based temporary Stage panning.
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
- f0ba0a5: Simplify the component instance contract now that instance internals are directly editable.

  **Breaking:** exposed properties are removed. `ComposeComponentPropertyDefinition` no longer
  appears in `ComposeBaseComponentAsset` or `ComposeResolvedComponentSnapshot`, and
  `instanceOverrides` keeps only its `operations` partition. Legacy assets and overrides are read
  through an explicit migration; property overrides whose field target can no longer be recovered
  are dropped rather than kept as operations that would fail the whole instance at resolve time.

  **Breaking:** component documents now require a single root of any kind instead of a single
  first-class Group. Extracting a single selected node reuses it as the component root, so creating
  a component from one container no longer inserts a redundant wrapper layer.

  **Breaking:** instance geometry follows the component root. Instances inherit the root's resize
  capability and expose its layout, appearance and clip; resize commands are rewritten to target the
  root through instance overrides, because the nested runtime only honours sizes stored in the
  component document.

  Saving a component source now syncs dependent instances automatically. Instances whose overrides
  all still apply refresh in place; instances with invalidated overrides keep their previous snapshot
  and list the failing operations for explicit confirmation.

- 8349817: Add Hug content sizing, disposable Renderer measurement adapters, precise asynchronous invalidation, and built-in Text, Image, SVG, and Page Slot intrinsic measurement.
- 8e8afbb: Make component instance internals editable in the host scene. Scene Tree lazily projects the
  resolved inner entity tree, Stage drills down one level per double click, and both stay in sync
  through composite `instanceId/innerId` addresses that exist only in the editing representation.

  Instance overrides move from a flat `propertyOverrides` map to a partitioned `instanceOverrides`
  holding `properties` and `operations`. Structural operations reuse the Variant operation algebra,
  so applying them to a parent source needs no lossy conversion. Legacy `propertyOverrides` is read
  only through an explicit migration.

  **Breaking:** `applyComposeInstancePropertyOverrides` is replaced by `applyComposeInstanceOverrides`,
  which consumes both partitions and returns `remainingOverrides`. The instance overrides panel
  `onChange` now receives the complete overrides object instead of a property map.

- 53d166b: 升级为严格 ComposeDocument v6，以 Yoga LayoutSnapshot 统一驱动 Stage 与 Preview，并提供显式
  v5→v6 迁移器、LayoutItem/GeometryConstraints、Flex Auto Layout 和嵌套页面布局运行时。
- bc2e0a4: Add first-class Group entities, Provider-backed Component Asset v1 resources, linked component
  instances, Unity-style variants, independent component workspaces, explicit Apply/Revert/update
  flows, and Scene Tree to Asset Browser component creation.
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

- f0b8c05: Add Fill sizing and Figma-style Auto Layout editing semantics: Flow move and nudge bake to
  Absolute, Fill resize converts the changed axis to Fixed, Scene Tree reparenting owns Flow order,
  and Group/Ungroup expose a shared disabled reason for Flow targets.
- dc66e03: Add universal node styles, Frame palette presets, shared Stage/Preview visual rendering,
  container inspection, and an instance-scoped Frame, Rectangle, and Text materials bundle.

### Patch Changes

- efd212d: Clean up the Auto Layout inspector after several rounds of iteration.

  Fixes a silent failure in the size fields: they accepted `0`, but core requires a finite positive
  `AxisSizing.value`, so the command was rejected during validation while the input kept showing the
  rejected value. `0` is now treated as invalid input and the draft rolls back, matching how blank and
  non-numeric input already behave.

  Refactors without behaviour change: the 845-line Auto Layout inspector is split into focused modules
  (options table, field editors, renderer registry, action menu, preview, factories) and no longer
  needs any `eslint-disable`; the Flex option table is pinned to the core types with `satisfies` so a
  wrong enum value fails to compile, and the "click the selected option again to reset" targets are
  derived from `createDefaultComposeFlexLayout()` instead of a second hand-written copy of the
  defaults; the layout action menu now implements the full WAI-ARIA menu keyboard pattern
  (arrow/Home/End with wrap-around, Escape returning focus to the trigger); the shared `useZh` helper
  is deduplicated; the layout-item inspector memoises its parent lookup instead of scanning every
  entity on each render.

  Removes dead code: the unreferenced `composeTransformUpdate` helper in stage-engine, an unnecessary
  `export` on an internal asset helper, and three CSS selector branches that could never match.

- 441ba73: 让基础复合几何字段使用 Property Panel 标准自定义类型行，统一名称、变换、尺寸和外边距的标签列，并保持窄侧栏控件完整可见。
- 3ad7620: Publish a supported styling contract for the property panel's structural containers. Every
  structural element now carries `data-property-part` (`toolbar`, `separator`, `fields`, `ungrouped`,
  `field`, `label`, `editor`, `actions`, `control`) alongside the existing field-level
  `data-property-*` attributes. Consumers that need to restyle the panel shell should target these
  attributes; the `property-panel__*` BEM class names are implementation details and are documented as
  such.

  Migrates the Auto Layout inspector in `@compose-ui/materials` off those internal class names, and
  adds a guard test so material stylesheets cannot reach into them again. Purely additive: no class
  name changed, selector specificity is preserved, and no golden screenshot moved.

- 7f0b5e3: 隔离同一页面并发读取的消费者取消信号，避免 React StrictMode 或嵌套 Page Slot 卸载时中止其他仍有效的页面加载；Page Slot 重试按钮同时阻止 Stage pointerdown 冒泡。
- 5212bb2: 让基础几何自定义类型分别使用 Property Panel 标准属性行、分隔线和操作列。
- Updated dependencies [749deb2]
- Updated dependencies [814cec7]
- Updated dependencies [5fd9605]
- Updated dependencies [fd1d51c]
- Updated dependencies [befd85e]
- Updated dependencies [6a3b60a]
- Updated dependencies [a40bc1f]
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
- Updated dependencies [3ad7620]
- Updated dependencies [57a82d6]
- Updated dependencies [814cec7]
- Updated dependencies [2f17288]
- Updated dependencies [6a3b60a]
- Updated dependencies [f0b8c05]
- Updated dependencies [6fe5cd6]
- Updated dependencies [dc66e03]
  - @compose-ui/assets@0.2.0
  - @compose-ui/component-registry@1.0.0
  - @compose-ui/core@1.0.0
  - @compose-ui/property-panel@1.0.0
  - @compose-ui/script-runtime@0.2.0
  - @compose-ui/ui-context@1.0.0
  - @compose-ui/components@1.0.0
  - @compose-ui/layout-engine@1.0.0
