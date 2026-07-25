## MODIFIED Requirements

### Requirement: Controller 驱动的默认组合

`useComposeEditorController` MUST 组合宿主提供的 TransactionRuntime 与 ComponentRegistry，并
管理 selection、expandedIds、activeFrameId、viewport、tool 和 StageInteractionController。
Controller MUST 为每个 Editor 实例创建一个 interaction controller 并同时交给默认 Stage 与
ComponentPalette；它 MUST 从 runtime 当前文档派生 SceneTree、Stage、History、Inspector、
Palette 与 Command 数据，不得复制或直接修改正式文档。

#### Scenario: 使用默认 Controller 工作区

- **WHEN** 宿主向 ComposeEditor 提供 controller，且没有覆盖对应插槽或 children
- **THEN** Component Library 与中央 Stage 使用同一 interaction controller
- **AND** Scene Graph、History、Inspector 与 Command 继续使用同一 runtime 文档

#### Scenario: 统一派发不同面板意图

- **WHEN** 用户从 Stage、Palette、SceneTree 或 Inspector 发起文档编辑
- **THEN** 对应意图通过同一 runtime dispatch
- **AND** Stage group 与 SceneTree reparent 使用 stage-engine 的同一空间命令工厂

#### Scenario: 卸载 Controller

- **WHEN** 默认 Editor controller 卸载
- **THEN** interaction controller 断开 surface、取消活动会话并清理订阅
- **AND** 不产生新的文档事务
