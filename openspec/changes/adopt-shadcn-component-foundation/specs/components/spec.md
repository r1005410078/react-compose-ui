## ADDED Requirements
### Requirement: Shadcn source-owned shared primitive foundation

`@compose-ui/components` MUST configure Shadcn for package-local source generation and MUST keep generated source,
its required dependencies and its configuration under version control. The package MUST expose only Compose-prefixed
public visual APIs and MUST keep raw Shadcn implementation names private. New shared primitives and patterns MUST
use Shadcn source primitives as their default basis; a non-Shadcn implementation MUST document why Shadcn cannot
provide the required semantics. Domain widgets MUST NOT be moved into this package solely to use Shadcn.

#### Scenario: Add a shared primitive through the configured workflow

- **WHEN** a maintainer adds a generic shared primitive to `@compose-ui/components`
- **THEN** the Shadcn CLI configuration resolves its package-local source, utility and component aliases
- **AND** the resulting public API, type names, tests and Storybook Story use Compose naming
- **AND** consumers do not import a raw Shadcn implementation symbol

#### Scenario: Retain a domain-specific or specialized component

- **WHEN** a component has document, scene, asset, geometry or other domain-specific behavior, or Shadcn has no
  equivalent primitive for its required behavior
- **THEN** the component remains in its domain package or specialized feature directory
- **AND** the implementation records the reason when it does not compose a Shadcn shared primitive

### Requirement: Shadcn primitives follow Compose theme boundaries

Shadcn-based shared primitives MUST derive visual semantics from Compose Theme tokens, MUST respect Dark/Light and
host token overrides, and MUST retain standalone fallbacks. Their published stylesheet MUST NOT inject Tailwind
Preflight or Shadcn default global `:root`/`.dark` theme state.

#### Scenario: Render a primitive under an overridden Compose theme

- **WHEN** a host wraps a Shadcn-based Compose primitive in `ComposeThemeProvider` with a Dark, Light or token
  override configuration
- **THEN** the primitive's background, foreground, border, focus and destructive semantics resolve from the
  corresponding Compose tokens
- **AND** no global reset or unrelated host element style is introduced

### Requirement: 共享 ContextMenu 与运行时右键 Hook

`@compose-ui/components` MUST 提供 Shadcn/Base UI 源码适配的 Compose 命名 ContextMenu 组合部件，
包括 Root、Trigger、Content、Item、Separator、Group、Label、Checkbox、Radio、Shortcut 与 Submenu。
包 MUST 同时导出 `useComposeContextMenu<T>`，让虚拟化或委托事件可以用右键事件或显式屏幕坐标打开
受控菜单，并保留当前 payload。原始 Base UI ContextMenu 符号不得成为公共 API。

#### Scenario: 用声明式 Trigger 打开共享菜单

- **WHEN** 消费者使用 `ComposeContextMenu`、`ComposeContextMenuTrigger` 与 Content 组合右键区域
- **THEN** 浏览器原生右键菜单被抑制，菜单在指针附近通过 Portal 打开
- **AND** Escape、菜单外按压、菜单项执行和 roving focus 遵循可访问菜单语义

#### Scenario: 用 Hook 在动态目标处打开菜单

- **WHEN** 消费者调用 `useComposeContextMenu<T>()` 返回的 `openAt`，并传入 React/DOM 右键事件或
  `{ x, y }` 与 payload
- **THEN** Hook 暴露的 `rootProps`、`open`、`anchorPoint` 与 `payload` 反映该次调用
- **AND** 新调用替换旧 payload，关闭时清除 payload 与锚点，并在可行时恢复触发元素焦点

#### Scenario: 在 Portal 中继承 Compose 外观

- **WHEN** Host 在 Dark、Light 或 token override 的 `ComposeThemeProvider` 下打开 ContextMenu
- **THEN** Portal 菜单自身携带解析后的 theme、locale 和 token style
- **AND** 普通、禁用和 destructive 项使用 Compose 语义色，且样式不引入全局 reset 或第二套主题状态

### Requirement: 全视口 Compose Dialog

`@compose-ui/components` MUST 提供 Shadcn/Base UI source-adapted 的 Compose 命名 Dialog 组合部件，
至少包括 Root、Trigger、Portal、Backdrop、Viewport、Content、Header、Footer、Title、Description 和
Close。Root MUST 支持 controlled 与 uncontrolled open；原始 Base UI Dialog 符号不得成为公共 API。
Dialog Portal MUST 默认挂载到 document body，Backdrop 与 Viewport MUST 覆盖完整浏览器 visual viewport，
不得受任一消费组件、Dockview panel 或 Editor root 的尺寸、overflow 和 stacking context 限制。Dialog
内容必须保留可配置尺寸而非强制内容全屏。

#### Scenario: 从裁剪容器打开 Dialog

- **WHEN** 消费者在带 overflow hidden 或 stacking context 的面板内打开 ComposeDialog
- **THEN** Backdrop 覆盖完整浏览器窗口，居中 Content 不被该面板裁剪
- **AND** Escape、Backdrop 按压、modal focus trap 与关闭后的触发元素焦点恢复遵循可访问 Dialog 语义

#### Scenario: 在 Portal 中继承 Compose 外观

- **WHEN** Host 在 Dark、Light 或 token override 的 ComposeThemeProvider 下打开 ComposeDialog
- **THEN** Portal 内容自身携带解析后的 theme、locale 和 token style
- **AND** Header、Content、Close、边框、焦点和 destructive 语义使用 Compose token，且不注入全局 reset

### Requirement: Shadcn 表单 Primitive 与 Dialog 操作层级

`@compose-ui/components` MUST 提供 Compose 命名的 Shadcn source-adapted `ComposeInput`，并使
`ComposeButton`、`ComposeInput` 与 Dialog 表单在无 Provider 时安全回退到 Dark token。Primary 与
destructive 操作的前景色 MUST 根据解析主题保持可读对比度；领域包不得再用专有 CSS 覆盖共享 Dialog
的表面、间距或底部操作样式。

#### Scenario: 在资源表单中使用共享 Primitive

- **WHEN** 用户在 Asset Browser 打开新建、重命名、未保存修改或 revision 冲突 Dialog
- **THEN** 名称输入和所有操作按钮使用 ComposeInput、ComposeButton 或 ComposeConfirmDialog 提供的
  共享视觉语义
- **AND** Dialog 在 Dark/Light 下保持紧凑的 Header、表单字段与 Footer 层级，不显示浏览器默认按钮样式

### Requirement: Color Picker 支持颜色通道透明度

`ComposeColorPicker` MUST 支持独立于 RGB 的受控 Alpha 值，并在默认情况下显示可访问的 0–100% Alpha
range。Picker MUST 接受 `#rgb`、`#rgba`、`#rrggbb`、`#rrggbbaa` 与 `transparent`；用户编辑后 MUST 输出
小写 `#rrggbb`（100%）或 `#rrggbbaa`（其余透明度）。`allowAlpha` MUST 允许宿主关闭 Alpha 编辑，
`allowTransparent` MUST 继续只控制完全透明快捷操作。触发器与 Alpha 控件 MUST 在棋盘格上预览透明度，
且不得显示 HEX、RGB 或 HSL 文本输入。

#### Scenario: 调整半透明颜色

- **WHEN** 用户以 `#33669980` 打开 Color Picker 并调整 Alpha range
- **THEN** 色盘和色相保留 `#336699` 对应的 RGB 状态，Alpha 控件暴露当前百分比
- **AND** 变更仅通过 `onValueChange` 发出规范化的八位小写 HEX
- **AND** Alpha 恢复为 100% 时发出六位小写 HEX

#### Scenario: 保持完全透明与禁用 Alpha 的语义

- **WHEN** 用户选择完全透明快捷操作，或宿主以 `allowAlpha={false}` 挂载 Picker
- **THEN** 快捷操作继续发出 `transparent`
- **AND** 关闭 Alpha 后不会显示或允许修改 Alpha range
- **AND** readOnly、disabled、Theme/I18n Portal 与焦点恢复语义保持不变
