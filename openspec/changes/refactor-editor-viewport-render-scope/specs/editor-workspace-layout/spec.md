## ADDED Requirements

### Requirement: 视口更新的渲染范围

Controller MUST 把 viewport 作为可订阅的会话状态持有，使 viewport 更新只重渲订阅了 viewport 的
组件。与 viewport 无关的工作区面板 MUST NOT 因为纯 viewport 更新而重渲。`controller.viewport`
读取 MUST 返回当前快照，`setViewport` 的签名与受控 Stage 契约 MUST 保持不变。

#### Scenario: 平移不重渲无关面板

- **WHEN** 用户平移画布，只有 viewport 发生变化
- **THEN** 场景树、Inspector 与命令面板不重新渲染
- **AND** Stage 与工具栏读取到新的 viewport 快照

#### Scenario: 宿主读取视口

- **WHEN** 宿主读取 `controller.viewport`
- **THEN** 返回当前 viewport 快照
- **AND** 需要跟随 viewport 变化重渲的宿主通过订阅入口获得通知

#### Scenario: 切换文档重置视口

- **WHEN** 宿主换用另一个 runtime
- **THEN** viewport 重置为初始值
- **AND** 订阅方收到重置后的快照
