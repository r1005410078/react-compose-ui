# history Specification

## Purpose

本规范定义可独立安装的 React 会话快照历史能力，供编辑器或其他 React 宿主统一管理文档状态
的提交、撤销、重做与任意历史跳转。能力范围包括不可变时间线、受控历史面板、文档级快捷键、
独立样式入口和包发布边界，并明确连续输入合并、历史分支裁剪、容量上限、会话生命周期以及
宿主不可变更新责任，确保 UI 展示协议与未来可能采用的底层事务实现保持解耦。
## Requirements
### Requirement: 独立历史记录包

系统 MUST 提供可独立安装的 `@compose-ui/history` React 包。该包 MUST 不依赖 `core`、
`editor`、`scene-tree` 或 `property-panel`，并 MUST 将 React、ReactDOM 和 JSX runtime 保持为
peer dependency 或构建外置依赖。

#### Scenario: 独立消费历史能力

- **WHEN** 宿主只安装并导入 `@compose-ui/history`
- **THEN** 宿主可以使用 `useHistory`、`HistoryPanel` 和 `useHistoryShortcuts`
- **AND** 不需要加载任何其他 Compose UI 业务包

### Requirement: 不可变会话时间线

系统 MUST 通过 `useHistory<T>` 管理当前值、从旧到新的历史条目、活动条目以及撤销和重做能力。
系统 MUST 使用宿主提供的不可变值引用，不得隐式深拷贝、序列化或持久化 `T`。

#### Scenario: 提交与逐步导航

- **WHEN** 宿主从初始值连续提交两个不同值
- **THEN** 时间线包含基线和两个按提交顺序排列的动作
- **AND** undo、redo 与 navigate 分别恢复对应快照
- **AND** 这些导航操作不新增历史条目

#### Scenario: 忽略无变化提交

- **WHEN** 提交值被 `isEqual` 判定为与当前值相同
- **THEN** 当前值、活动条目和历史长度保持不变

#### Scenario: 重置时间线

- **WHEN** 宿主调用 reset 并提供新值和可选标签
- **THEN** 系统使用该值建立唯一基线
- **AND** 不再允许访问重置前的 undo 或 redo 历史

### Requirement: 合并、分支与容量限制

系统 MUST 默认在 750ms 内合并连续且 `mergeKey` 相同的提交，MUST 在历史中间产生新提交时
丢弃 redo 分支，并 MUST 默认只保留最近 100 个动作且不把基线计入该上限。

#### Scenario: 合并连续输入

- **WHEN** 两次提交使用相同 mergeKey 且间隔不超过合并窗口
- **THEN** 第二次提交更新现有动作的结果而不增加历史条目
- **AND** 一次 undo 恢复到该连续输入开始前的值

#### Scenario: 从过去状态创建新分支

- **WHEN** 用户 undo 到过去条目后提交新值
- **THEN** 原有未来条目被删除
- **AND** redo 不再恢复已删除的旧分支

#### Scenario: 超出容量限制

- **WHEN** 已提交动作数量超过配置上限
- **THEN** 系统只保留上限数量的最新动作
- **AND** 最早仍可到达的快照成为标记为“较早状态”的新基线

### Requirement: 受控历史面板

系统 MUST 提供接收 `HistoryNavigationController` 的 `HistoryPanel`。面板 MUST 按最新在上的顺序
显示条目、标识当前和未来状态，并 MUST 允许点击任意非当前记录进行导航。

#### Scenario: 显示并跳转历史

- **WHEN** 面板收到包含过去、当前和未来条目的控制器
- **THEN** 当前条目显示勾选、高亮和 `aria-current`
- **AND** 未来条目使用弱化样式但保持可操作
- **AND** 点击过去或未来条目时以其稳定 ID 调用 navigate

#### Scenario: 空历史面板

- **WHEN** 控制器没有活动条目
- **THEN** 面板显示可访问的空状态

### Requirement: 历史快捷键

系统 MUST 提供可挂载到 React 容器的快捷键处理器，支持 Cmd/Ctrl+Z 撤销、
Cmd/Ctrl+Shift+Z 和 Ctrl+Y 重做。识别到快捷键时 MUST 阻止浏览器文本撤销，但在 IME
组合输入期间 MUST 不拦截事件。

#### Scenario: 输入框内撤销编辑器历史

- **WHEN** 焦点位于挂载处理器的输入框内且用户按下 Cmd/Ctrl+Z
- **THEN** 系统调用历史控制器的 undo
- **AND** 浏览器不会单独修改输入框文本历史

#### Scenario: 组合输入期间按键

- **WHEN** 键盘事件处于 IME composing 状态
- **THEN** 系统不调用 undo 或 redo
- **AND** 不阻止该键盘事件的默认行为

### Requirement: 样式与包文档

系统 MUST 提供 `@compose-ui/history/styles.css`，使用禁用 Preflight 且具有包级前缀的样式，
并 MUST 说明独立使用时的样式导入、不可变值要求、默认容量和会话生命周期。

#### Scenario: 宿主独立加载样式

- **WHEN** 宿主导入 history 样式并为面板提供确定高度
- **THEN** 标题、列表、当前态、未来态、空状态和滚动条正确显示
- **AND** history 样式不重置宿主全局元素样式

### Requirement: 历史面板内建本地化

HistoryPanel MUST 接受可选 zh-CN 或 en-US locale，并在未提供时保持 zh-CN。标题、当前/未来状态、
空状态和可访问名称 MUST 使用内建词典；宿主提供的历史 label MUST 保持原文。

#### Scenario: 使用英文历史面板

- **WHEN** 宿主以 en-US 挂载 HistoryPanel
- **THEN** 面板 chrome、状态和可访问名称显示英文
- **AND** 各历史条目的宿主 label 不被翻译

#### Scenario: 独立使用默认语言

- **WHEN** 宿主独立挂载 HistoryPanel 且不提供 locale
- **THEN** 现有简体中文内建文案和导航行为保持不变

### Requirement: Compose-prefixed History API
The history package MUST expose compose-prefixed panel, hook and controller contracts and colocate their
implementation, test and Storybook story.

#### Scenario: History navigation
- **WHEN** a consumer navigates immutable history through the vNext hook and panel
- **THEN** undo, redo, reset and shortcut behaviour remain unchanged

### Requirement: 历史右键导航菜单

HistoryPanel MUST 为历史条目和空白区域提供跳转、撤销、重做和跳转最新操作。

#### Scenario: 跳转到右键历史项
- **WHEN** 用户在历史条目的菜单中选择跳转
- **THEN** 面板调用 controller.navigate 对应稳定 ID

### Requirement: 历史菜单只提示已安装的键位

HistoryPanel MUST 仅在宿主显式传入 `ComposeHistoryShortcuts` 时为撤销和重做菜单项显示快捷键；
默认 Editor 面板 MUST 透传当前 preferences 中的 history 键位。

#### Scenario: 独立面板不暗示未安装的快捷键
- **WHEN** 独立 HistoryPanel 没有收到 `shortcuts`
- **THEN** 撤销和重做菜单项不显示快捷键

