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

偏好 MUST 用 KeyboardEvent.code 与 primary/shift/alt 修饰键保存单个按键或组合键。系统 MUST
按平台显示 primary，允许重新绑定、清除、单项恢复和全部恢复；同一作用域的规范化冲突 MUST
显示冲突动作并拒绝写入。

#### Scenario: 重新绑定动作

- **WHEN** 用户捕获一个当前作用域未占用的单键或组合键
- **THEN** 完整 preferences 使用规范化 binding 更新该动作
- **AND** 后续键盘事件执行新 binding 而不再执行旧 binding

#### Scenario: 拒绝同作用域冲突

- **WHEN** 用户为动作捕获已被同作用域另一个动作占用的 binding
- **THEN** 设置面板显示冲突动作名称且保持原 binding
- **AND** 不调用偏好变更回调

#### Scenario: 清除和恢复快捷键

- **WHEN** 用户清除、恢复单项或恢复全部快捷键
- **THEN** 对应动作变为禁用、恢复默认或全部恢复默认
- **AND** 每次有效操作只通知一次完整 preferences

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
