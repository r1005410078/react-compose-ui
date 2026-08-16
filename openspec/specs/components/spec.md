# components Specification

## Purpose
TBD - created by archiving change add-asset-browser. Update Purpose after archive.
## Requirements
### Requirement: 通用受控虚拟 Tree
`@compose-ui/components` MUST export compose-prefixed, domain-free React interaction patterns only. Each public
visual pattern MUST live in a feature directory with colocated type, model, style, test and Storybook story.

#### Scenario: Tree public pattern
- **WHEN** a consumer imports the shared tree pattern
- **THEN** it imports `ComposeTree` and `ComposeTreeProps` from the package root and receives the existing
  controlled selection, expansion, keyboard and ARIA behaviour

#### Scenario: Domain-free boundary
- **WHEN** a new shared component is proposed
- **THEN** it is rejected unless it has no ComposeDocument, asset Provider, transaction or editor workflow semantics

### Requirement: Tree 选择、键盘与过滤

Tree MUST 支持单选、primary 切换、Shift 连续选择、方向键导航、Home/End、左右键展开收起和
Enter 激活。过滤 MUST 保留匹配节点的祖先并把结果路径视为展开，不得改写宿主 expandedIds。

#### Scenario: 使用键盘浏览和选择

- **WHEN** 用户聚焦一行并使用方向键、Home、End、Enter 或带修饰键的选择
- **THEN** 焦点、激活和受控选择按可见树顺序更新
- **AND** 输入控件和 contenteditable 保留原生键盘行为

#### Scenario: 过滤树并保留路径

- **WHEN** filter 只匹配一个深层节点
- **THEN** 结果包含该节点及全部祖先并显示完整路径
- **AND** 过滤结束后使用原受控展开状态

### Requirement: Tree 拖排与可访问性

Tree MUST 提供可选 Pointer 拖排，生成包含顶层 itemIds、parentId 与 index 的单次 move intent。
拖排 MUST 拒绝移入自身、后代、叶节点或宿主禁止的目标，并支持阈值、自动滚动、延迟展开、
pointer cancel 与 Escape 取消。Tree MUST 使用 treegrid/row、level、setsize、posinset、selected
和 expanded ARIA。

#### Scenario: 拖动多选项

- **WHEN** 用户拖动包含祖先和后代的多选集合到合法目标并松手
- **THEN** Tree 只提交顶层选择的一次 move intent
- **AND** 拖动期间显示目标和预览但不修改受控 items

#### Scenario: 取消或拒绝拖排

- **WHEN** Pointer 被取消、用户按 Escape，或目标会形成循环
- **THEN** Tree 清除预览且不提交 move intent
- **AND** 受控选择、展开和 items 保持不变

### Requirement: 共享 Shadcn Color Picker

`@compose-ui/components` MUST 公开受控 `ComposeColorPicker`。它 MUST 以包内 Shadcn CLI 生成的 Base UI Popover 源码为基础，提供色块 Trigger、饱和度/明度色盘、色相滑条和可选完全透明操作；不得引入第三方颜色运行时依赖、Preflight 或另一套全局主题。Picker 的可见 UI MUST 不显示 HEX、RGB、HSL 或 CSS 文本输入。

#### Scenario: 选择不透明色或透明
- **WHEN** 用户从 Color Picker 的色盘、色相滑条或透明操作修改值
- **THEN** 受控回调只提交小写 `#rrggbb` 或 `transparent`
- **AND** Trigger、Escape、焦点恢复、键盘色盘操作、Theme 和 I18n 均保持可访问

#### Scenario: 读取无法精确编辑的既有 CSS 色
- **WHEN** 受控值为 `rgb()`、`hsl()`、`rgba()` 或其他非 HEX CSS 色
- **THEN** Trigger 继续尝试以该 CSS 值预览颜色，色盘从安全回退色打开
- **AND** 原值在用户未修改前不得被转换

### Requirement: 共享确认对话框

系统 MUST 提供受控 ComposeConfirmDialog，用于不可逆操作的可访问确认。

#### Scenario: 取消危险操作
- **WHEN** 用户在 destructive 确认框选择取消或按 Escape
- **THEN** 对话框关闭且不调用确认回调

### Requirement: 共享键位格式化

系统 MUST 公开无领域语义的 `ComposeKeybinding`、`formatComposeKeybinding()` 与
`formatComposeKeybindings()`，供设置与菜单以同一规则显示当前平台键位。

#### Scenario: 格式化当前平台的多个键位
- **WHEN** 消费者在 macOS 或其他平台格式化一个或多个键位
- **THEN** macOS 使用符号修饰键，其他平台使用 `Ctrl+Shift+…` 形式
- **AND** 多个替代键位以 ` / ` 分隔，空数组或未提供的键位返回空字符串

### Requirement: Compose Color/Paint Picker 与会话颜色历史

ComposePaintPicker MUST 在单个紧凑 Theme/I18n Popover 中提供 Solid、Gradient 和 Image 页签；不得打开嵌套 Picker 或全屏 Dialog。Gradient MUST 支持 2–8 个稳定、可选择、可移动和可删除的色标，并为 Linear、Radial 与 Angular 提供与其几何模型一致的直接操纵和精确输入。图片选择和上传 MUST 由宿主适配器完成，组件不得依赖 Asset Browser；当适配器提供完整图片集合时，Picker MUST 在同一 Popover 内提供无滚动分页选择。

#### Scenario: 完整管理渐变色标

- **WHEN** 用户添加、选择、拖动或删除 Gradient 色标
- **THEN** Picker 以稳定唯一 ID 提交按位置排序的 2–8 个色标
- **AND** 连续添加色标时使用最大空档中点并自动选中新色标
- **AND** 一次指针拖动最多提交一个受控值变化

#### Scenario: 编辑三类渐变几何

- **WHEN** 用户通过预览手柄、方向盘、快捷方向或精确输入编辑 Gradient
- **THEN** Linear 更新起止点，Radial 更新中心与水平/垂直半径，Angular 更新中心与起始角
- **AND** Pointer cancel、Escape 或外部值变化取消未提交草稿
- **AND** 默认折叠状态保持紧凑且没有内部滚动条

#### Scenario: 选择图片填充

- **WHEN** 用户在图片页选择最近图片或完成宿主上传
- **THEN** Picker 实时提交带稳定资源引用的 Image Paint
- **AND** 首次创建时使用填充、100% 图片透明度和 40% 紫色叠加，使图片设置卡完整呈现
- **AND** 用户可以编辑适配模式、透明度和颜色叠加

#### Scenario: 在 Popover 内浏览完整图片库

- **WHEN** 图片适配器提供超过四张可引用图片且用户选择浏览图片
- **THEN** Picker 在同一 Popover 内以每页八张展示图片并提供上一页和下一页
- **AND** 主图片页最多展示四张最近使用图片
- **AND** 主页面和资源页面均不产生横向或纵向内部滚动

#### Scenario: 替换图片并保留设置

- **WHEN** 当前值已经是 Image Paint 且用户选择另一张图片
- **THEN** Picker 仅替换稳定资源引用
- **AND** 保留当前适配模式、图片透明度和颜色叠加

#### Scenario: 图片资源加载与上传状态

- **WHEN** 图片适配器正在加载、加载失败、不支持稳定引用或不支持上传
- **THEN** Picker 显示对应的紧凑状态和可用操作
- **AND** 不可用操作被禁用而不是静默无响应
- **AND** 加载失败时用户可以重试

#### Scenario: 兼容宿主一次性资源选择器

- **WHEN** 旧宿主只提供最近图片和 onBrowse
- **THEN** Picker 继续调用宿主一次性资源选择器
- **AND** 不要求宿主迁移现有调用

### Requirement: 用户意图驱动的吸管

Picker MUST 只在用户点击或快捷键激活时调用 native EyeDropper，并通过 AbortSignal 处理 Escape、卸载或字段切换。API 不可用或失败时 MUST 经受控 fallback port 请求 Stage 采样，且不静默丢失当前值。

#### Scenario: 原生吸管不可用

- **WHEN** 浏览器不提供 EyeDropper
- **THEN** Picker 进入宿主提供的 Stage 采样模式
- **AND** 取消采样后恢复原值和焦点

### Requirement: Editor 图片资源自动适配

ComposeEditor MUST 在配置 Asset Provider 且未显式提供图片适配器时，自动派生 Picker 所需的图片列表和上传能力。自动适配 MUST 只写入稳定资源引用，并正确释放临时预览资源。

#### Scenario: 从 Provider 自动加载图片

- **WHEN** Editor 配置支持稳定引用的 Asset Provider
- **THEN** 默认 Inspector 图片页递归展示具有 assetKey 的图片文件
- **AND** 非图片文件、没有稳定引用的文件和无法解析的单项资源不会写入 Paint

#### Scenario: 上传图片到配置目录

- **WHEN** Provider 支持 createFile 且用户上传有效图片
- **THEN** Editor 把图片保存到配置的父目录或 Provider 根目录
- **AND** 重名文件使用最小可用数字后缀
- **AND** 成功后返回并选择稳定资源引用

#### Scenario: 显式图片适配器覆盖自动适配

- **WHEN** 宿主同时配置 Asset Provider 和 paintImageLibrary
- **THEN** 默认 Inspector 只使用显式 paintImageLibrary
- **AND** Editor 不启动 Provider 图片扫描或上传适配

### Requirement: 通用角度快捷选择器

Components MUST 发布受控且无文档语义的角度选择器，组合紧凑数值输入、弹层转盘和常用快捷角。
该组件 MUST 使用 Compose Theme/I18n，并完整实现 slider、弹层焦点与取消语义。

#### Scenario: 输入任意角度

- **WHEN** 用户在紧凑输入或弹层精确输入中输入任意有限角度并按 Enter 或离开输入框
- **THEN** 组件只提交一次原始角度，包括负角度和超过一圈的角度
- **AND** Escape、空白或非法草稿恢复受控值且不提交

#### Scenario: 使用转盘和快捷角

- **WHEN** 用户拖动转盘、使用方向键或选择 0°/90°/180°/270° 快捷角
- **THEN** 转盘以 0–359° 显示并提交等价归一化角度
- **AND** 拖动期间只更新本地预览，pointerup 最多提交一次最终值
- **AND** Arrow 键按 1° 调整，Shift 加 Arrow 键按 15° 调整

#### Scenario: 取消并恢复焦点

- **WHEN** 用户按 Escape、在提交前关闭弹层或组件卸载
- **THEN** 未提交草稿被丢弃且受控值不变化
- **AND** 正常关闭弹层后焦点恢复到触发按钮，只读或禁用状态不能打开和编辑

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

