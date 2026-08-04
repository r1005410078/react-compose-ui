# @compose-ui/pages

## 0.2.0

### Minor Changes

- 53d166b: 升级为严格 ComposeDocument v6，以 Yoga LayoutSnapshot 统一驱动 Stage 与 Preview，并提供显式
  v5→v6 迁移器、LayoutItem/GeometryConstraints、Flex Auto Layout 和嵌套页面布局运行时。
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

- 7f0b5e3: 隔离同一页面并发读取的消费者取消信号，避免 React StrictMode 或嵌套 Page Slot 卸载时中止其他仍有效的页面加载；Page Slot 重试按钮同时阻止 Stage pointerdown 冒泡。
- Updated dependencies [749deb2]
- Updated dependencies [3f2fbf9]
- Updated dependencies [8349817]
- Updated dependencies [749deb2]
- Updated dependencies [53d166b]
- Updated dependencies [7769c06]
- Updated dependencies [d922b24]
- Updated dependencies [57a82d6]
- Updated dependencies [2f17288]
- Updated dependencies [6a3b60a]
- Updated dependencies [f0b8c05]
- Updated dependencies [6fe5cd6]
- Updated dependencies [dc66e03]
  - @compose-ui/assets@0.2.0
  - @compose-ui/core@1.0.0
