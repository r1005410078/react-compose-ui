## MODIFIED Requirements

### Requirement: 边缘工具区

系统 MUST 使用 Dockview Edge Groups 实现 Scene Graph、Component Library、Component Inspector
和底部日志/命令区。Scene Graph 与 Component Library MUST 作为标签共享固定 `left` Edge Group，
Scene Graph 初始活动；Component Inspector 必须固定在 `right`；Transaction Log 与 Command
必须作为标签共享 `bottom` Edge Group。Scene Graph 与 Component Inspector 的 `left`/`right`
Edge Group MUST 承载在一个挂载于中央 Canvas 面板内部的嵌套 Dockview 实例中；底部 `bottom`
Edge Group MUST 留在外层 Dockview 实例，使其宽度与两侧 Edge Group 的折叠/展开状态无关，
始终横跨整个编辑器宽度。

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
- **THEN** 该 Edge Group 在折叠和展开状态之间切换，折叠后显示为窄轨道
- **AND** 展开时恢复折叠前的尺寸

#### Scenario: 底部工具区不受两侧折叠影响

- **WHEN** 用户折叠或展开左侧 Scene Graph、右侧 Component Inspector 中的任意一个或两个
  Edge Group
- **THEN** 底部 `bottom` Edge Group 的宽度和横向位置保持不变，继续横跨整个编辑器宽度
- **AND** 底部工具区内容不重新挂载

#### Scenario: Strict Mode 重放嵌套工作区

- **WHEN** React Strict Mode 重放编辑器的挂载生命周期
- **THEN** 外层 Dockview 只有一个中央面板和一个 `bottom` Edge Group
- **AND** 嵌套的中层 Dockview 只有一个 `left` Edge Group 和一个 `right` Edge Group
- **AND** 两层 Dockview 中同名的可访问 landmark 使用不同的 `aria-label`，不会被辅助技术
  当成同一个区域
