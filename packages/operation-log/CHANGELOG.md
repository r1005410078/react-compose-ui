# @compose-ui/operation-log

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
- da1e11d: Add a scope-isolated local operation audit log with IndexedDB persistence, memory fallback, coalescing, structured snapshots, and a compact React viewer.

### Patch Changes

- Updated dependencies [6a3b60a]
- Updated dependencies [a40bc1f]
- Updated dependencies [749deb2]
- Updated dependencies [814cec7]
- Updated dependencies [6fe5cd6]
  - @compose-ui/ui-context@1.0.0
  - @compose-ui/components@1.0.0
