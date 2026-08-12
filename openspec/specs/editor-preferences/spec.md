# editor-preferences Specification

## Purpose
TBD - created by archiving change add-editor-preferences-shortcuts. Update Purpose after archive.
## Requirements
### Requirement: 实例级编辑器偏好

`@compose-ui/editor` MUST 导出 theme、locale、shortcut action、keybinding 与完整 preferences 公共
类型，并提供产生独立默认值的 factory。`ComposeEditor` MUST 支持受控 `preferences` 和实例内
非受控 `defaultPreferences`；系统 MUST NOT 自动读写 localStorage、ComposeDocument、History
或 Operation Log。

#### Scenario: 使用实例内默认偏好

- **WHEN** 宿主不提供受控 preferences 并挂载 ComposeEditor
- **THEN** 编辑器使用 dark、zh-CN 和默认快捷键
- **AND** 有效修改只保留到该组件实例卸载

#### Scenario: 使用受控偏好

- **WHEN** 宿主提供 preferences 并在 onPreferencesChange 后回传新值
- **THEN** 编辑器显示宿主当前完整规范化偏好
- **AND** editor 不在宿主更新前私自提交受控显示状态

#### Scenario: 通知完整偏好

- **WHEN** 用户有效修改主题、语言或一个快捷键
- **THEN** onPreferencesChange 收到包含所有字段的规范化新对象
- **AND** 修改不产生文档事务、会话历史或操作日志

### Requirement: 主题解析

编辑器 MUST 支持 dark、light 与 system 主题，并通过共享 Theme Context 注入工作区。根节点
MUST 设置解析后的 `data-compose-theme="dark|light"`；system MUST 由 ThemeProvider 监听
`prefers-color-scheme`，但偏好值仍保持 system。

#### Scenario: 切换明确主题

- **WHEN** 用户选择 dark 或 light
- **THEN** editor 根节点立即设置对应 data-compose-theme
- **AND** 默认工作区全部内建面板使用同一主题 token

#### Scenario: 跟随系统主题

- **WHEN** theme 为 system 且系统配色发生变化
- **THEN** editor 根节点在 dark 与 light 间更新
- **AND** onPreferencesChange 不因系统媒体查询变化而改写 theme 值

### Requirement: 内建界面语言

编辑器 MUST 支持 zh-CN 与 en-US，通过共享 I18n Context 注入并在根节点设置对应 `lang`。
内建词典 MUST 覆盖设置弹框、Dockview 标题、Stage、SceneTree、History、CommandPanel、
PropertyPanel、OperationLog、基础材料 Inspector 和默认 Palette；系统 MUST NOT 自动翻译
宿主插槽、registry 标签、Schema metadata 或业务组件内容。

#### Scenario: 切换默认工作区语言

- **WHEN** 用户把语言从 zh-CN 切换为 en-US
- **THEN** 所有默认内建工作区 chrome 显示英文并更新可访问名称
- **AND** 宿主提供的内容保持原样

#### Scenario: 检测缺失翻译

- **WHEN** 内建组件请求当前词典不存在的文案 key
- **THEN** 测试或开发构建显式报告缺失 key
- **AND** 界面不静默显示原始 key

### Requirement: 可配置单次快捷键

编辑器 MUST 保留现有可配置 Stage 动作和默认键位。`stage.fitContainer` MUST 从当前选择或最近
Container 祖先推导目标；`edit.group`/`edit.ungroup` MUST 操作统一 Container，不依赖旧 Frame
节点或 activeFrameId。

#### Scenario: 使用选择推导的 Container 快捷键

- **WHEN** 用户选择 Container 后代并触发适配 Container
- **THEN** Stage 适配最近 Container 祖先
- **AND** 根 Renderer Entity 没有 Container 祖先时动作稳定 no-op

#### Scenario: 使用组合快捷键

- **WHEN** 用户在 Canvas 根选择多个 Entity 并触发 group/ungroup
- **THEN** 快捷键分别创建或解除统一 Container
- **AND** 默认键位和可配置冲突规则保持不变

### Requirement: 设置模态弹框

编辑器 MUST 通过左下角真实 button 打开编辑器范围内的模态设置弹框。弹框 MUST 提供顶部全局
搜索、左侧外观/语言/键盘快捷方式分类、右侧设置内容和关闭按钮。设置按钮 MUST 提供
aria-haspopup、aria-expanded 与 aria-controls；弹框 MUST 管理焦点陷阱且不得重建 Dockview。

#### Scenario: 打开和关闭设置

- **WHEN** 用户点击齿轮、按 primary+Comma 或再次执行当前设置快捷键
- **THEN** 模态弹框打开或关闭，按钮 expanded 状态同步且 Dockview 在打开期间 inert
- **AND** 打开时焦点进入搜索框并限制在弹框内，关闭时焦点恢复到齿轮

#### Scenario: 使用 Escape 关闭设置

- **WHEN** 设置弹框打开且用户按 Escape、点击遮罩或关闭按钮
- **THEN** 弹框关闭且 Dockview 尺寸与活动面板保持不变
- **AND** 快捷键捕获期间 Escape 只取消捕获并保持弹框打开

#### Scenario: 搜索设置

- **WHEN** 用户输入匹配动作、外观或语言名称的检索词
- **THEN** 右侧改为跨分类结果并只显示匹配项
- **AND** 点击左侧分类会清空检索并只显示该分类，重新打开默认显示外观

### Requirement: 快捷键输入隔离

编辑器导航快捷键 MUST 在 input、textarea、select、contenteditable 或 IME composing 期间忽略，
但 History 已定义的文档级撤销重做语义 MUST 保持不变。方向键微调、Shift 微调、Escape、滚轮
和中键 MUST 作为只读手势显示，不能在首版设置中修改。

#### Scenario: 文本编辑期间按导航键

- **WHEN** 焦点位于可编辑元素或事件正在 IME composing
- **THEN** Stage 工具、缩放、适配、吸附或临时平移动作不执行
- **AND** 浏览器或输入控件保留默认编辑行为

#### Scenario: 查看只读手势

- **WHEN** 用户打开快捷键设置并检索方向键、Escape、滚轮或中键
- **THEN** 面板显示对应手势与说明
- **AND** 不提供捕获、清除或恢复单项控件

#### Scenario: 在命令检索框内输入

- **WHEN** 焦点位于命令面板检索输入框且用户输入与 Stage 快捷键相同的字符
- **THEN** 当前工具、视口与文档均不因该输入发生变化
- **AND** 字符正常进入检索查询

### Requirement: Asset Browser 内建本地化与主题

Asset Browser MUST 直接消费共享 Theme/I18n Context。内建中英文词典 MUST 覆盖工具栏、Tree、
资源网格、预览、确认、冲突、错误和 Monaco 外层 chrome；文件名、Provider label 与宿主内容
不得自动翻译。

#### Scenario: 切换资源面板语言和主题

- **WHEN** 用户把 Editor 切换到 light/en-US 并打开 Assets
- **THEN** Asset Browser 的 surface、border、hover、selected、focus 和 scrollbar 使用浅色 token
- **AND** 全部内建 chrome 与 ARIA 显示英文，真实文件名保持原文

#### Scenario: 独立使用 Asset Browser

- **WHEN** 宿主在无 Provider Context 环境独立挂载 AssetBrowser
- **THEN** Browser 使用 dark 与 zh-CN 默认 chrome
- **AND** 不要求依赖 ComposeEditor 或 ComposeDocument

### Requirement: Paint 吸管快捷键

Editor Preferences MUST 提供可配置的 `paint.eyedropper` 快捷键，默认 `I`。该快捷键只在 Color/Paint Picker 已打开的编辑上下文触发，且不得影响文本输入或普通 Stage tool。

#### Scenario: 在打开的 Picker 中触发吸管

- **WHEN** 背景 Paint 或 Solid Color Picker 打开且用户按下配置的吸管快捷键
- **THEN** 系统启动 native 或 Stage fallback 取色
- **AND** Picker 未打开时该键不改变 Stage 工具

### Requirement: 编辑器动作目录

`@compose-ui/editor` MUST 把可配置编辑器动作装配为可执行的命令面板动作，复用既有动作 ID、双语标签、用户
可改键位与作用域分组。动作的执行 MUST 自行选择派发命令或修改会话状态：改变文档的动作经事务运行时派发并
进入历史，视口与工具等会话状态动作不得进入事务历史。

不适合一次性调用的动作 MUST 不出现在目录中，而不是以不可用形式出现。宿主未提供入口的动作 MUST 整条省略，
不得产出调用后无反应的条目。

#### Scenario: 文档动作进入历史

- **WHEN** 用户从命令面板执行编组、解组、复制或删除动作
- **THEN** 该动作经事务运行时派发并产生一条事务
- **AND** 历史面板新增对应条目

#### Scenario: 视口动作不进入历史

- **WHEN** 用户从命令面板执行缩放、适配或工具切换动作
- **THEN** 视口或当前工具随之改变
- **AND** 事务历史条目数量不变

#### Scenario: 不可用动作说明原因

- **WHEN** 当前选区不满足编组或解组的前提
- **THEN** 目录中对应动作带有不可用原因
- **AND** 该原因来自既有可用性判断，而非面板自行编造的文案

#### Scenario: 排除临时手势动作

- **WHEN** 宿主构建动作目录
- **THEN** 按住不放的临时平移动作不出现在目录中
- **AND** 该动作仍可通过其键位正常使用

### Requirement: 动作执行与呈现分层

编辑器动作目录 MUST 把动作的执行与可用性判断同界面语言解耦：执行层只产出「是否可用」与「如何
执行」，不产出任何文案；呈现层在其之上补齐本地化名称、分组与不可用原因。

编辑器 MUST 把同一个执行层同时提供给命令面板与 Stage 快捷键，使键盘、工具栏与命令面板对同一动作
产生一致结果。

#### Scenario: 键盘与命令面板结果一致

- **WHEN** 用户先用键盘执行适配选择，再从命令面板执行同一动作
- **THEN** 两次得到相同的视口结果
- **AND** 两条路径都不产生事务

#### Scenario: 执行层不依赖界面语言

- **WHEN** 宿主在未提供 locale 的情况下取用执行层
- **THEN** 动作仍可判断可用性并执行
- **AND** 不可用状态以稳定标识而非本地化文案表达

### Requirement: 可配置绘制与变换工具快捷键

Editor Preferences MUST 将 select、move、scale、rotate、pan、container、rectangle、line、arrow、circle 与 text
工具动作纳入同一份可配置 shortcut action map，并对同一 scope 使用现有冲突检测。默认触发键 MUST 与 toolbar
tooltip、shape menu 和设置面板显示的键位一致；输入与 IME 隔离规则保持不变。

#### Scenario: 使用默认工具快捷键

- **WHEN** Stage 获得焦点且用户按下某一默认工具快捷键
- **THEN** controller 请求切换到对应工具且默认 toolbar 的 pressed 状态同步
- **AND** 该快捷键不会产生文档事务

#### Scenario: 拒绝工具快捷键冲突

- **WHEN** 用户在 Settings 中尝试把两个相同 scope 的工具动作绑定为同一按键组合
- **THEN** Preferences 返回现有稳定冲突标识并拒绝该绑定
- **AND** 已保存的其他快捷键保持不变

