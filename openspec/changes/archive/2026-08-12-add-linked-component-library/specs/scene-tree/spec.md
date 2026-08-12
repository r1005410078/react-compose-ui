## ADDED Requirements

### Requirement: 普通行的无领域外部拖拽

SceneTree MUST 允许宿主为普通行拖拽注册外部 drag type 和受控生命周期，并只传递稳定 nodeIds、普通
payload 与 client point；它 MUST NOT 依赖 Core、assets、Component Store 或 Asset Browser。一次普通行
拖拽在树内有效目标结束时 MUST 继续执行既有 move，在注册外部目标结束时 MUST 结束外部会话，其他位置
MUST 取消且不移动节点。

#### Scenario: 树内移动优先

- **WHEN** 普通行拖拽在合法树内目标松开
- **THEN** SceneTree 只发出既有 move operation
- **AND** 外部会话收到 cancel 而不是 drop

#### Scenario: 导出规范化多选

- **WHEN** 用户拖动已选行并在树外注册目标松开
- **THEN** 外部生命周期收到按树规则规范化的稳定 nodeIds、注册 type 和最终 client point
- **AND** SceneTree 不发出 move operation

#### Scenario: 外部拖拽不可用

- **WHEN** 宿主未注册外部拖拽或选择被宿主拒绝
- **THEN** 普通树内选择、键盘和重排保持现有行为

### Requirement: 宿主提供节点语义图标

SceneTree MUST 渲染宿主提供的 Group、Container、Base Component 与 Variant 图标及 accessible name，
不得仅用颜色区分语义。

#### Scenario: 区分结构与关联实例

- **WHEN** 节点模型包含 Group、Container、Base instance 与 Variant instance
- **THEN** 每种语义显示可辨识形状和对应 accessible name
