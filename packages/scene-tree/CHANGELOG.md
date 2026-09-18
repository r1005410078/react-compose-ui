# @compose-ui/scene-tree

## 1.0.0

### Major Changes

- 6fe5cd6: 发布 vNext React API：第一方视觉组件统一为 Compose 命名、移除 legacy React facade，并以功能目录和
  Storybook 组件文档作为稳定维护边界。资源浏览器的文件预览改为显式打开的 Canvas Dockview 文档标签，
  避免单击资源时读取内容或替换当前目录网格。

  同一 vNext 发布还将 ComposeDocument 升级至 v5：背景从字符串颜色改为结构化 Paint，新增透明度、
  线性/径向/角向渐变、会话颜色历史、吸管与 Stage 直接渐变编辑；受影响的 Core、Editor、Preview、
  Stage、组件注册和物料包均随该 major 变更发布。

### Minor Changes

- 6a3b60a: Add a shared theme and i18n Context package, a VS Code-style editor-scoped settings
  dialog, complete first-party dark/light and Chinese/English chrome, configurable
  single-stroke shortcuts, and Space-based temporary Stage panning.
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

- bc2e0a4: Add first-class Group entities, Provider-backed Component Asset v1 resources, linked component
  instances, Unity-style variants, independent component workspaces, explicit Apply/Revert/update
  flows, and Scene Tree to Asset Browser component creation.
- 59e8008: Add a virtualized standalone scene tree package with a shared command hook, tree-local copy/cut/paste intents, and integrate it as the editor's default Scene Graph content.

### Patch Changes

- 814cec7: Replace hand-written right-click menus with the shared Compose ContextMenu primitive while preserving domain actions and selection behavior.
- 749deb2: 优化窄栏历史记录的视觉层级，并防止宿主按钮 reset 覆盖组件字号。

  在 SceneTree watch 构建期间保留上一份有效声明文件，避免 Editor 开发时短暂丢失类型。

- Updated dependencies [6a3b60a]
- Updated dependencies [a40bc1f]
- Updated dependencies [749deb2]
- Updated dependencies [814cec7]
- Updated dependencies [6fe5cd6]
  - @compose-ui/ui-context@1.0.0
  - @compose-ui/components@1.0.0
