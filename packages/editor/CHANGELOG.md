# @compose-ui/editor

## 1.0.0

### Major Changes

- 3f2fbf9: Extract Stage coordinates, scene indexing, snapping, gestures, external Palette drag, and spatial command planning into the new headless `@compose-ui/stage-engine` package.

  Replace `StageDragController` and `dragController` with the shared `StageInteractionController` API, and remove geometry and command re-exports from `@compose-ui/stage`.

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

- 6a3b60a: Upgrade ComposeDocument to the v2 canvas schema and add reversible grid and guide commands,
  Godot-style Stage rulers and origin axes, grid/node/guide snapping for move and resize,
  document-backed draggable guides, accessible dynamic scrollbars, editor canvas controls, and
  Preview support that ignores canvas editing metadata.
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
- befd85e: Add a standalone immutable snapshot history package with an accessible panel and document undo/redo shortcuts, integrate it below the editor scene tree, and keep controlled property drafts synchronized when history navigation restores an earlier value.
- 6a3b60a: Add a shared theme and i18n Context package, a VS Code-style editor-scoped settings
  dialog, complete first-party dark/light and Chinese/English chrome, configurable
  single-stroke shortcuts, and Space-based temporary Stage panning.
- 76111a7: Add command search and execution to the command panel, plus an editor action catalog that feeds it.

  `@compose-ui/command-panel` gains a `ComposeCommandAction` protocol and an `actions` prop. The panel
  renders a search input implementing the WAI-ARIA Combobox with List Autocomplete pattern: an empty
  query keeps the existing debugger layout untouched, `/` lists every action grouped by category, and
  plain text filters on title, category, keywords, and id. A leading `/` is an optional prefix rather
  than a mode selector. Actions carrying a `disabledReason` render as unavailable and show that reason
  instead of silently doing nothing. Hosts supply already-localized titles; the panel never rewrites
  them and never registers action keybindings.

  `@compose-ui/editor` assembles the 16 configurable editor actions into that catalog, reusing their
  existing ids, bilingual labels, user-remappable keybindings, and scopes. Each action decides for
  itself whether to dispatch a command or mutate session state, so viewport and tool actions become
  searchable without polluting the transaction history — no change to the `EditorCommand` or
  `TransactionRuntime` protocols. Press-and-hold temporary pan is excluded, and actions whose entry
  point the host does not provide are omitted entirely rather than rendered as dead entries.

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
- 749deb2: Add a shared virtual Tree, a Provider-backed Asset Browser with previews and Monaco editing, migrate SceneTree to the shared Tree, and add the default Editor Assets tab.
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

- d922b24: Add the page system: pages persist as `*.page.json` ComposeDocument v5 files, the new
  `@compose-ui/pages` package owns the page catalog, document store and `app.json` manifest,
  the asset browser gains host context-menu and entry-badge slots plus a read-only preview,
  and the editor opens pages as tabs with per-page transaction runtimes, home-page marking and
  read-only JSON viewing.
- 57a82d6: Add the versioned JSON compose document, atomic reversible command transaction runtime,
  built-in editing commands, structured CommandPanel, component registry, infinite DOM/SVG
  Stage, document Preview, and controller-driven editor composition.
- 9089a8f: Let the host take over Stage shortcut actions so keyboard, toolbar, and command palette agree.

  `ComposeStage` gains an optional `onShortcutAction`. When a configurable action matches, the Stage
  asks the host first; returning `true` means the host executed it, so the Stage prevents the default
  and skips its built-in path. Returning `false` — or omitting the prop entirely — keeps every existing
  built-in behavior, so standalone Stage usage is unchanged. Press-and-hold temporary pan, Escape, and
  arrow-key nudging never participate.

  `@compose-ui/editor` splits its action catalog into a language-independent execution layer and a
  localization layer on top, then feeds that one execution layer to both the command panel and the
  Stage. This fixes a real divergence: "fit selection" previously used `min(w/target.w, h/target.h) *
0.85` from the keyboard but `min((w-128)/b.w, (h-128)/b.h)` from the toolbar, so the same action
  produced two different viewports depending on how you invoked it. Group/ungroup unavailability
  reasons are now bilingual as well; they previously came from `stage-engine` as Chinese-only strings.

- f0b8c05: Add Fill sizing and Figma-style Auto Layout editing semantics: Flow move and nudge bake to
  Absolute, Fill resize converts the changed axis to Fixed, Scene Tree reparenting owns Flow order,
  and Group/Ungroup expose a shared disabled reason for Flow targets.
- 59e8008: Add a virtualized standalone scene tree package with a shared command hook, tree-local copy/cut/paste intents, and integrate it as the editor's default Scene Graph content.
- 8e7a5af: Keep the editor chrome out of the pan path. The Stage viewport is now a subscribable session state
  source instead of controller render state, so a pan frame only wakes the canvas and the toolbar
  rather than re-rendering the scene tree, Inspector and command panel. Adds
  `useComposeStageViewport(controller)` for hosts that render their own `ComposeStage` or show a zoom
  readout.

  Behaviour change: `controller.viewport` and `stageProps.viewport` still read the current snapshot,
  but components that only read them no longer re-render automatically when the viewport changes.
  Subscribe with `useComposeStageViewport` if you need to follow it. `setViewport` is unchanged and
  still accepts both a value and an updater.

  Measured on a 1500-Entity document with the full editor mounted: frame interval p50 16.1 ms →
  8.3 ms, p95 24.3 ms → 10.2 ms, frames over 20 ms 8–26 → 0.

- dc66e03: Add universal node styles, Frame palette presets, shared Stage/Preview visual rendering,
  container inspection, and an instance-scoped Frame, Rectangle, and Text materials bundle.

### Patch Changes

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
- b60ba2c: Move the component library into the Scene Graph's lower tool dock, present its basic presets as
  a compact equal-size categorized grid, and add a pointer-following drag placeholder preview.
- Updated dependencies [efd212d]
- Updated dependencies [749deb2]
- Updated dependencies [814cec7]
- Updated dependencies [5fd9605]
- Updated dependencies [fd1d51c]
- Updated dependencies [befd85e]
- Updated dependencies [749deb2]
- Updated dependencies [6a3b60a]
- Updated dependencies [76111a7]
- Updated dependencies [a40bc1f]
- Updated dependencies [f0ba0a5]
- Updated dependencies [b60ba2c]
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
- Updated dependencies [7f0b5e3]
- Updated dependencies [2f17288]
- Updated dependencies [efb36bb]
- Updated dependencies [9089a8f]
- Updated dependencies [6a3b60a]
- Updated dependencies [f0b8c05]
- Updated dependencies [59e8008]
- Updated dependencies [6fe5cd6]
- Updated dependencies [dc66e03]
  - @compose-ui/stage-engine@1.0.0
  - @compose-ui/assets@0.2.0
  - @compose-ui/asset-browser@1.0.0
  - @compose-ui/component-registry@1.0.0
  - @compose-ui/stage@1.0.0
  - @compose-ui/core@1.0.0
  - @compose-ui/property-panel@1.0.0
  - @compose-ui/scene-tree@1.0.0
  - @compose-ui/pages@0.2.0
  - @compose-ui/script-runtime@0.2.0
  - @compose-ui/history@1.0.0
  - @compose-ui/command-panel@1.0.0
  - @compose-ui/ui-context@1.0.0
  - @compose-ui/components@1.0.0
  - @compose-ui/component-library@0.2.0
  - @compose-ui/layout-engine@1.0.0
  - @compose-ui/cad@0.1.1
  - @compose-ui/animation@0.1.1
  - @compose-ui/cad-canvas@0.1.1
  - @compose-ui/animation-panel@0.1.1
