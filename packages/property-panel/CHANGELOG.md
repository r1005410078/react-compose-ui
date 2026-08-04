# @compose-ui/property-panel

## 1.0.0

### Major Changes

- 6fe5cd6: 发布 vNext React API：第一方视觉组件统一为 Compose 命名、移除 legacy React facade，并以功能目录和
  Storybook 组件文档作为稳定维护边界。资源浏览器的文件预览改为显式打开的 Canvas Dockview 文档标签，
  避免单击资源时读取内容或替换当前目录网格。

  同一 vNext 发布还将 ComposeDocument 升级至 v5：背景从字符串颜色改为结构化 Paint，新增透明度、
  线性/径向/角向渐变、会话颜色历史、吸管与 Stage 直接渐变编辑；受影响的 Core、Editor、Preview、
  Stage、组件注册和物料包均随该 major 变更发布。

### Minor Changes

- fd1d51c: Add a standalone controlled property panel that maps synchronous Valibot schemas to built-in and custom field renderers, with nested collection editing, validation drafts, search and filters, adaptive row actions, full-width renderers, explicitly enabled and separately controlled page/global variable bindings, and configurable UE4 compact-density theme tokens.
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
- 7769c06: Add the `node` base property editor so a property can reference a page: pick from a filterable
  candidate list or drop a page from the asset browser. Referenced pages render live on the editing
  canvas and in preview through the new `page-slot` material, which owns the loading state machine
  so neither Stage nor Preview needs its own. Adds a stable asset reference drag payload, the
  `nodeEditPort` / `pageDocumentPort` registry ports, and `createComposePageDocumentLoader`.
- 3ad7620: Publish a supported styling contract for the property panel's structural containers. Every
  structural element now carries `data-property-part` (`toolbar`, `separator`, `fields`, `ungrouped`,
  `field`, `label`, `editor`, `actions`, `control`) alongside the existing field-level
  `data-property-*` attributes. Consumers that need to restyle the panel shell should target these
  attributes; the `property-panel__*` BEM class names are implementation details and are documented as
  such.

  Migrates the Auto Layout inspector in `@compose-ui/materials` off those internal class names, and
  adds a guard test so material stylesheets cannot reach into them again. Purely additive: no class
  name changed, selector specificity is preserved, and no golden screenshot moved.

### Patch Changes

- 814cec7: Replace hand-written right-click menus with the shared Compose ContextMenu primitive while preserving domain actions and selection behavior.
- befd85e: Add a standalone immutable snapshot history package with an accessible panel and document undo/redo shortcuts, integrate it below the editor scene tree, and keep controlled property drafts synchronized when history navigation restores an earlier value.
- Updated dependencies [6a3b60a]
- Updated dependencies [a40bc1f]
- Updated dependencies [749deb2]
- Updated dependencies [814cec7]
- Updated dependencies [6fe5cd6]
  - @compose-ui/ui-context@1.0.0
  - @compose-ui/components@1.0.0
