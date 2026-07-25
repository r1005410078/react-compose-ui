## MODIFIED Requirements

### Requirement: 四区编辑器工作区

系统 MUST 在 `ComposeEditor` 首次挂载时建立四个宏观区域：左侧 Scene Graph 与 Component
Library、中间 Canvas 与 Stage Toolbar、右侧 Component Inspector、底部 Transaction Log 与
Command。中央 Canvas 必须获得扣除三个边缘区后的主要可用空间。

#### Scenario: 首次挂载编辑器

- **WHEN** 宿主挂载一个 `ComposeEditor`
- **THEN** 工作区显示 Scene Graph、Component Library 与 Component 图标标签，以及标题为
  “Canvas”“日志”“命令”的三个文字标签
- **AND** 三个图标标签分别保留对应的可访问名称和悬停提示
- **AND** Scene Graph 使用设计组件图标，且左侧活动栏底部显示带可访问名称的设置图标
- **AND** Stage Toolbar 显示在 Canvas 内容区域顶部
- **AND** Canvas 内容显示在中央主要区域

#### Scenario: Strict Mode 重放初始化

- **WHEN** React Strict Mode 重放编辑器的挂载生命周期
- **THEN** 左、右、底部各只存在一个 Edge Group
- **AND** 六个默认外层面板各只存在一个实例

### Requirement: 边缘工具区

系统 MUST 使用 Dockview Edge Groups 实现 Scene Graph、Component Library、Component Inspector
和底部日志/命令区。Scene Graph 与 Component Library MUST 作为标签共享固定 `left` Edge Group，
Scene Graph 初始活动；Component Inspector 必须固定在 `right`；Transaction Log 与 Command
必须作为标签共享 `bottom` Edge Group。

#### Scenario: 检查默认边缘组

- **WHEN** Dockview 工作区完成初始化
- **THEN** `getEdgeGroup('left')` 返回同时包含 Scene Graph 与 Component Library 面板的组
- **AND** Scene Graph 是左侧初始活动面板
- **AND** `getEdgeGroup('right')` 返回包含 Component 面板的组
- **AND** `getEdgeGroup('bottom')` 返回同时包含 Transaction Log 与 Command 面板的组
- **AND** Transaction Log 是底部初始活动面板

#### Scenario: 调整边缘区尺寸

- **WHEN** 用户拖动任一 Edge Group 与中央 Canvas 之间的分隔边界
- **THEN** 对应 Edge Group 尺寸随拖动变化
- **AND** Canvas 使用剩余可用空间重新布局
- **AND** 各区域内容保持挂载并可继续操作

#### Scenario: 折叠和展开边缘区

- **WHEN** 用户点击一个 Edge Group 的活动标签
- **THEN** 该 Edge Group 在折叠和展开状态之间切换
- **AND** 展开时恢复折叠前的尺寸

### Requirement: React 内容插槽

系统 MUST 将显式 `children` 渲染在 Canvas 内容区域，并将 `componentLibraryPanel`、
`stageToolbar`、`inspectorPanel`、`transactionLogPanel`、`commandPanel` 分别渲染在对应语义
区域。`canvasToolbar` MUST 作为已废弃兼容别名继续工作，且与 stageToolbar 同时提供时后者优先。
Scene Graph MUST 默认渲染 `@compose-ui/scene-tree` 的空场景树，宿主可以通过 `sceneTreeProps`
提供受控树状态，或通过 `sceneGraphPanel` 完整覆盖默认树。没有 controller 时，缺少的其他可选
插槽 MUST 显示可访问占位。

#### Scenario: 宿主提供全部工作区内容

- **WHEN** 宿主同时传入 `children`、`sceneTreeProps`、componentLibraryPanel 和其余命名插槽
- **THEN** 默认场景树和每份内容显示在对应语义区域中
- **AND** 显式 children 覆盖任何 controller 默认 Stage

#### Scenario: 默认显示空场景树

- **WHEN** 宿主未传入 controller、sceneTreeProps 和 sceneGraphPanel
- **THEN** Scene Graph 区域显示可访问的空场景树
- **AND** 其他缺少的命名插槽显示说明区域用途的占位内容

#### Scenario: 宿主覆盖场景树

- **WHEN** 宿主提供 `sceneGraphPanel`，包括显式提供 `null`
- **THEN** Scene Graph 区域使用该值完整覆盖默认场景树或 controller 派生树

#### Scenario: Stage Toolbar 优先级

- **WHEN** 宿主同时提供 stageToolbar 与 canvasToolbar
- **THEN** Canvas 顶部只渲染 stageToolbar
- **WHEN** 宿主只提供 canvasToolbar
- **THEN** 旧 toolbar 继续正常渲染

#### Scenario: 插槽与场景树内容更新

- **WHEN** 宿主在编辑器挂载后更新任一插槽、sceneTreeProps 或 controller
- **THEN** 对应区域显示最新内容
- **AND** Dockview 组、面板和用户调整后的尺寸不被重建

### Requirement: 嵌入与公共 API 边界

系统 MUST 保留 `ComposeEditor` 根 `<section>` 的标准 HTML 属性、默认可访问名称、
`data-compose-ui="editor"` 和 core 包标识。`ComposeEditorProps` MUST 提供可选的 controller、
sceneTreeProps、componentLibraryPanel 与 stageToolbar，并保留 canvasToolbar 兼容属性。系统不得
从 `@compose-ui/editor` 公共入口转导 SceneTree、Stage、ComponentRegistry、CommandPanel 或
Dockview 的公共成员、序列化布局、Edge Group 对象或内部面板对象。

#### Scenario: 透传宿主属性

- **WHEN** 宿主向 `ComposeEditor` 传入 `className`、`style`、事件或自定义 `aria-label`
- **THEN** 这些属性应用于编辑器根 `<section>`
- **AND** Dockview 内部节点不覆盖宿主提供的根属性

#### Scenario: 使用编辑器公共类型

- **WHEN** 消费者从 `@compose-ui/editor` 导入公开成员
- **THEN** 消费者可以使用 `ComposeEditor`、`ComposeEditorProps`、
  `ComposeEditorController` 和 `useComposeEditorController`
- **AND** 独立包类型继续从各自 `@compose-ui/*` 公共入口导入
- **AND** 消费者不需要导入或引用任何 Dockview 类型

## ADDED Requirements

### Requirement: Controller 驱动的默认组合

`useComposeEditorController` MUST 组合宿主提供的 TransactionRuntime 与 ComponentRegistry，并
管理 selection、expandedIds、activeFrameId、viewport、tool 和 StageDragController。Controller
MUST 从 runtime 当前文档派生 SceneTree、Stage、History、Inspector、Palette 与 Command 数据，
不得复制或直接修改正式文档。

#### Scenario: 使用默认 Controller 工作区

- **WHEN** 宿主向 ComposeEditor 提供 controller，且没有覆盖对应插槽或 children
- **THEN** Component Library 显示 ComponentPalette，Scene Graph 显示派生 SceneTree
- **AND** 中央显示默认 Stage，右侧显示当前 definition Inspector
- **AND** 现有 HistoryPanel 使用 runtime 导航 controller，Command 区显示 CommandPanel

#### Scenario: 统一派发不同面板意图

- **WHEN** SceneTree 发出结构操作、Inspector 发出属性修改、Stage 完成手势或 CommandPanel 提交预设
- **THEN** controller 把意图映射为同一 runtime 的结构化命令
- **AND** 所有未覆盖视图从提交后的同一 ComposeDocument 重新派生

#### Scenario: 清理失效会话状态

- **WHEN** 成功命令、undo、redo、navigate 或 reset 删除或隐藏当前选中节点
- **THEN** controller 从 selection、expandedIds 与 activeFrameId 中移除失效 ID
- **AND** 视口、Dockview 布局和其他仍有效会话状态保持不变

### Requirement: 单一事务观察边界

Controller MUST 接受可选 transaction observer，并只在 committed 与成功的 undo/redo/navigate 后
通知。Observer 的返回值或异步失败 MUST NOT 阻止或回滚 runtime；noop、rejected 和 reset MUST
NOT 作为成功编辑通知。

#### Scenario: 记录成功事务和导航

- **WHEN** runtime committed，或成功完成 undo、redo、navigate
- **THEN** observer 收到包含 transaction、方向、source 和 targets 的单一事件
- **AND** 宿主可以在一个位置映射到 operationLog.record

#### Scenario: 忽略非成功编辑

- **WHEN** dispatch 返回 noop/rejected 或宿主 reset 文档
- **THEN** transaction observer 不被当作成功编辑调用
- **AND** CommandPanel 仍可独立显示 noop/rejected 调试事件

#### Scenario: 日志写入失败

- **WHEN** observer 启动的 operation log Promise 失败
- **THEN** runtime 当前文档、历史和各编辑视图保持已提交状态
