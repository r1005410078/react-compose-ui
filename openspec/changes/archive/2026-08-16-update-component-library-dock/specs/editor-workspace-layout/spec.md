## RENAMED Requirements

- FROM: `### Requirement: 可选场景历史分栏`
- TO: `### Requirement: 场景下方工具分栏`

- FROM: `### Requirement: Dockview 场景历史布局`
- TO: `### Requirement: Dockview 场景工具布局`

## MODIFIED Requirements

### Requirement: 四区编辑器工作区

系统 MUST 在 `ComposeEditor` 首次挂载时建立四个宏观区域：左侧 Scene Graph（内部包含下方基础
组件与可选历史工具区）、中间 Canvas 与 Stage Toolbar、右侧 Component Inspector、底部资源、Command
与 Transaction Log 工具组。中央 Canvas 必须获得扣除三个边缘区后的主要可用空间。

#### Scenario: 首次挂载编辑器

- **WHEN** 宿主挂载一个 `ComposeEditor`
- **THEN** 工作区显示 Scene Graph、默认选中的基础组件工具区，以及标题为“Canvas”“资源”“命令”“日志”的四个文字标签
- **AND** Scene Graph 使用设计组件图标，且左侧活动栏底部显示带可访问名称的设置图标
- **AND** Stage Toolbar 显示在 Canvas 内容区域顶部
- **AND** Canvas 内容显示在中央主要区域

#### Scenario: Strict Mode 重放初始化

- **WHEN** React Strict Mode 重放编辑器的挂载生命周期
- **THEN** 左、右、底部各只存在一个 Edge Group
- **AND** 六个默认外层面板各只存在一个实例

### Requirement: 边缘工具区

系统 MUST 使用 Dockview Edge Groups 实现左侧 Scene Graph、Component Inspector 和底部资源/命令/日志区。
左侧固定 `left` Edge Group MUST 只包含 Scene Graph 外层面板；其内部子 Dockview MUST 将场景内容置于
上方，并将基础组件与可选 History 作为下方工具组的标签。基础组件 MUST 是下方工具组初始活动标签。
Component Inspector 必须固定在 `right`；资源、Command 与 Transaction Log 必须按此顺序作为标签共享 `bottom`
Edge Group。该组首次创建时 MUST 默认收起，资源是其初始活动标签；后续初始化不得重置用户选择的展开状态。

#### Scenario: 检查默认边缘组

- **WHEN** Dockview 工作区完成初始化
- **THEN** `getEdgeGroup('left')` 返回只包含 Scene Graph 外层面板的组
- **AND** 内层下方工具组显示基础组件，且基础组件是其初始活动面板
- **AND** 宿主提供 History 时，下方工具组同时包含 History 标签
- **AND** `getEdgeGroup('right')` 返回包含 Component 面板的组
- **AND** `getEdgeGroup('bottom')` 返回按资源、Command、Transaction Log 顺序包含三个面板的组
- **AND** 底部组处于收起状态，资源是其初始活动面板

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
区域。`componentLibraryPanel` MUST 位于 Scene Graph 内部下方工具组的基础组件标签中；`canvasToolbar`
MUST 作为已废弃兼容别名继续工作，且与 stageToolbar 同时提供时后者优先。Scene Graph MUST 默认渲染
`@compose-ui/scene-tree` 的空场景树，宿主可以通过 `sceneTreeProps` 提供受控树状态，或通过
`sceneGraphPanel` 完整覆盖默认树。没有 controller 时，缺少的其他可选插槽 MUST 显示可访问占位。

#### Scenario: 宿主提供全部工作区内容

- **WHEN** 宿主同时传入 `children`、`sceneTreeProps`、componentLibraryPanel 和其余命名插槽
- **THEN** 默认场景树和每份内容显示在对应语义区域中
- **AND** 基础组件内容显示在场景树下方的基础组件标签内
- **AND** 显式 children 覆盖任何 controller 默认 Stage

#### Scenario: 默认显示空场景树

- **WHEN** 宿主未传入 controller、sceneTreeProps 和 sceneGraphPanel
- **THEN** Scene Graph 区域显示可访问的空场景树
- **AND** 下方基础组件区域和其他缺少的命名插槽显示说明区域用途的占位内容

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

### Requirement: 场景下方工具分栏

系统 MUST 在现有 Scene Graph 外层面板中始终挂载子 Dockview：场景内容作为上方真实 Dockview
面板，基础组件作为下方真实 Dockview 面板。宿主提供 `history` 或显式提供 `historyPanel` 时，History
MUST 作为基础组件的同组真实标签加入；未提供时系统不得显示空 History 标签。基础组件 MUST 是下方
工具组的初始活动面板。

#### Scenario: 使用默认历史面板

- **WHEN** 宿主向 ComposeEditor 提供 HistoryNavigationController
- **THEN** 子 Dockview 下方工具组显示基础组件与 `@compose-ui/history` 的 HistoryPanel 标签
- **AND** 基础组件保持下方初始活动标签
- **AND** history 控制器驱动编辑器焦点范围内的撤销重做快捷键

#### Scenario: 覆盖历史面板

- **WHEN** 宿主显式提供 historyPanel，包括 null
- **THEN** History 标签使用该值完整覆盖默认 HistoryPanel
- **AND** 同时提供的 history 控制器仍然驱动编辑器快捷键

#### Scenario: 不启用历史

- **WHEN** 宿主没有提供 history 且没有显式提供 historyPanel
- **THEN** 子 Dockview 仍显示场景内容和下方基础组件
- **AND** 下方工具组不显示 History 标签，且编辑器不拦截历史快捷键

### Requirement: Dockview 场景工具布局

系统 MUST 使用 Dockview 原生垂直布局和 sash，默认按 60%/40% 分配场景与下方工具组高度，并保持
场景内容至少 160px、下方工具内容至少 120px。子 Dockview 布局状态 MUST 只存活于当前编辑器实例，
不得进入页面文档或持久化存储。

#### Scenario: 调整下方工具高度

- **WHEN** 用户拖动 Dockview 原生 sash
- **THEN** 场景内容和下方工具组按约束调整高度
- **AND** 两侧内容保持挂载并可继续操作

#### Scenario: 编辑器内容更新

- **WHEN** 宿主更新场景、基础组件、历史控制器或其他插槽
- **THEN** 子 Dockview 面板显示最新内容
- **AND** 用户调整后的子 Dockview 布局和外层 Dockview 布局不被重建
