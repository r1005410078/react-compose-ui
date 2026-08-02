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

