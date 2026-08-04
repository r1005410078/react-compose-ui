# @compose-ui/asset-browser

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
- 749deb2: Add a shared virtual Tree, a Provider-backed Asset Browser with previews and Monaco editing, migrate SceneTree to the shared Tree, and add the default Editor Assets tab.
- 7769c06: Add the `node` base property editor so a property can reference a page: pick from a filterable
  candidate list or drop a page from the asset browser. Referenced pages render live on the editing
  canvas and in preview through the new `page-slot` material, which owns the loading state machine
  so neither Stage nor Preview needs its own. Adds a stable asset reference drag payload, the
  `nodeEditPort` / `pageDocumentPort` registry ports, and `createComposePageDocumentLoader`.
- d922b24: Add the page system: pages persist as `*.page.json` ComposeDocument v5 files, the new
  `@compose-ui/pages` package owns the page catalog, document store and `app.json` manifest,
  the asset browser gains host context-menu and entry-badge slots plus a read-only preview,
  and the editor opens pages as tabs with per-page transaction runtimes, home-page marking and
  read-only JSON viewing.

### Patch Changes

- 814cec7: Replace hand-written right-click menus with the shared Compose ContextMenu primitive while preserving domain actions and selection behavior.
- Updated dependencies [749deb2]
- Updated dependencies [6a3b60a]
- Updated dependencies [a40bc1f]
- Updated dependencies [749deb2]
- Updated dependencies [814cec7]
- Updated dependencies [6fe5cd6]
  - @compose-ui/assets@0.2.0
  - @compose-ui/ui-context@1.0.0
  - @compose-ui/components@1.0.0
