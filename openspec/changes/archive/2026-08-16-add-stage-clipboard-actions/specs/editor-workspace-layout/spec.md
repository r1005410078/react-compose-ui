## ADDED Requirements

### Requirement: 画布与场景树共享会话剪贴板

默认编辑器 MUST 让 Stage 与 SceneTree 共用同一份会话内存剪贴板。任一表面的复制或剪切 MUST
立即可被另一表面粘贴。粘贴 MUST 使用建议落点，并由现有场景树操作规划器生成文档事务。该剪贴板
MUST NOT 写入系统剪贴板、ComposeDocument 或 History 条目本身。

#### Scenario: 场景树复制后在画布粘贴

- **WHEN** 用户在场景树复制一个节点，再聚焦画布并执行粘贴
- **THEN** 文档插入该节点的新副本并选中副本
- **AND** 只产生一次文档事务

#### Scenario: 画布剪切后在场景树粘贴

- **WHEN** 用户在画布剪切一个节点，再于场景树有效位置粘贴
- **THEN** 该节点被移动到建议落点
- **AND** 剪贴板被清空
