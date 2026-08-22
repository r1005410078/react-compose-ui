# @compose-ui/stage

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

- 6a3b60a: Upgrade ComposeDocument to the v2 canvas schema and add reversible grid and guide commands,
  Godot-style Stage rulers and origin axes, grid/node/guide snapping for move and resize,
  document-backed draggable guides, accessible dynamic scrollbars, editor canvas controls, and
  Preview support that ignores canvas editing metadata.
- f0b8c05: Add Fill sizing and Figma-style Auto Layout editing semantics: Flow move and nudge bake to
  Absolute, Fill resize converts the changed axis to Fixed, Scene Tree reparenting owns Flow order,
  and Group/Ungroup expose a shared disabled reason for Flow targets.
- dc66e03: Add universal node styles, Frame palette presets, shared Stage/Preview visual rendering,
  container inspection, and an instance-scoped Frame, Rectangle, and Text materials bundle.

### Patch Changes

- b60ba2c: Move the component library into the Scene Graph's lower tool dock, present its basic presets as
  a compact equal-size categorized grid, and add a pointer-following drag placeholder preview.
- efb36bb: Keep canvas panning smooth on large scenes. The DOM Scene content is now decoupled from the
  viewport so a pan frame only updates the scene root transform instead of rebuilding and diffing
  every Entity subtree, and the bootstrap content bounds are computed lazily instead of walking the
  whole scene on every render for a result that is discarded once the engine publishes a scroll range.
  Measured on a 1500-Entity document: frame interval p50 16.1 ms → 8.3 ms, p95 24 ms → 9.3 ms.
- Updated dependencies [efd212d]
- Updated dependencies [749deb2]
- Updated dependencies [5fd9605]
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
- Updated dependencies [57a82d6]
- Updated dependencies [814cec7]
- Updated dependencies [2f17288]
- Updated dependencies [6a3b60a]
- Updated dependencies [f0b8c05]
- Updated dependencies [6fe5cd6]
- Updated dependencies [dc66e03]
  - @compose-ui/stage-engine@1.0.0
  - @compose-ui/assets@0.2.0
  - @compose-ui/component-registry@1.0.0
  - @compose-ui/core@1.0.0
  - @compose-ui/script-runtime@0.2.0
  - @compose-ui/ui-context@1.0.0
  - @compose-ui/components@1.0.0
  - @compose-ui/canvas-kit@0.1.1
