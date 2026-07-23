## ADDED Requirements

### Requirement: 可选场景历史分栏

系统 MUST 在宿主提供 `history` 或显式提供 `historyPanel` 时，在现有 Scene Graph 外层面板中
挂载子 Dockview，并把场景内容与历史内容分别渲染为上、下两个真实 Dockview 面板。系统 MUST
在未提供历史输入时不挂载子 Dockview，并保持原有单栏场景内容。

#### Scenario: 使用默认历史面板

- **WHEN** 宿主向 ComposeEditor 提供 HistoryNavigationController
- **THEN** 子 Dockview 的 History 面板在场景树面板下方显示 `@compose-ui/history` 的 HistoryPanel
- **AND** 外层 Dockview 组和面板数量保持不变
- **AND** history 控制器驱动编辑器焦点范围内的撤销重做快捷键

#### Scenario: 覆盖历史面板

- **WHEN** 宿主显式提供 historyPanel，包括 null
- **THEN** 下方历史区域使用该值完整覆盖默认 HistoryPanel
- **AND** 同时提供的 history 控制器仍然驱动编辑器快捷键

#### Scenario: 不启用历史

- **WHEN** 宿主没有提供 history 且没有显式提供 historyPanel
- **THEN** 场景内容继续占满原 Scene Graph 面板
- **AND** 编辑器不拦截历史快捷键

### Requirement: Dockview 场景历史布局

系统 MUST 使用 Dockview 原生垂直布局和 sash，默认按 60%/40% 分配场景与历史面板高度，并
保持场景内容至少 160px、历史内容至少 120px。子 Dockview 布局状态 MUST 只存活于当前编辑器
实例，不得进入页面文档或持久化存储。

#### Scenario: 调整历史高度

- **WHEN** 用户拖动 Dockview 原生 sash
- **THEN** 场景内容和历史内容按约束调整高度
- **AND** 两侧内容保持挂载并可继续操作

#### Scenario: 编辑器内容更新

- **WHEN** 宿主更新场景、历史控制器或其他插槽
- **THEN** 两个子 Dockview 面板显示最新内容
- **AND** 用户调整后的子 Dockview 布局和外层 Dockview 布局不被重建
