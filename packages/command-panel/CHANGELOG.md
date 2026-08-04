# @compose-ui/command-panel

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

- 57a82d6: Add the versioned JSON compose document, atomic reversible command transaction runtime,
  built-in editing commands, structured CommandPanel, component registry, infinite DOM/SVG
  Stage, document Preview, and controller-driven editor composition.

### Patch Changes

- Updated dependencies [749deb2]
- Updated dependencies [6a3b60a]
- Updated dependencies [a40bc1f]
- Updated dependencies [3f2fbf9]
- Updated dependencies [8349817]
- Updated dependencies [749deb2]
- Updated dependencies [53d166b]
- Updated dependencies [7769c06]
- Updated dependencies [d922b24]
- Updated dependencies [57a82d6]
- Updated dependencies [814cec7]
- Updated dependencies [2f17288]
- Updated dependencies [6a3b60a]
- Updated dependencies [f0b8c05]
- Updated dependencies [6fe5cd6]
- Updated dependencies [dc66e03]
  - @compose-ui/core@1.0.0
  - @compose-ui/ui-context@1.0.0
  - @compose-ui/components@1.0.0
