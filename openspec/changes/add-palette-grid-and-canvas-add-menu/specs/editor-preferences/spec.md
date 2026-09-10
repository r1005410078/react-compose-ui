## ADDED Requirements

### Requirement: 物料面板排法是编辑器偏好

物料面板的排法（网格 / 列表）MUST 存在编辑器偏好里（`palette.mode`，默认 `'grid'`），
MUST NOT 写进 ComposeDocument。切换它 MUST NOT 产生文档事务、会话历史或操作日志。

判据是既有那条——**看这份事实住在哪里**：它回答「我想怎么看」，不改变文档里画了什么，因此与
工作区布局同一层，而不是与网格步长那类文档字段同一层。

编辑器 MUST 把该偏好接到面板的受控 `mode` 上，并在面板上报时按既有偏好通路提交完整规范化偏好。

#### Scenario: 排法跟着偏好走

- **WHEN** 宿主提供 `palette.mode` 为 `'list'` 的受控偏好
- **THEN** 物料面板按列表排，且用户切换后 `onPreferencesChange` 收到完整的新偏好

#### Scenario: 切换排法不动文档

- **WHEN** 用户在网格与列表之间切换
- **THEN** 文档、撤销栈与操作日志都不变
