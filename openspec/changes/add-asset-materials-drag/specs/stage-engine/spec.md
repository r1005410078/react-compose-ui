## ADDED Requirements

### Requirement: 资源批量外部拖入会话

Stage Engine MUST 以纯数据 assets descriptor 支持 external begin/move/end/cancel，并用现有
SceneIndex 解析 drop 世界点和最深合法 Frame。

#### Scenario: 资源落到 Frame 或 Canvas

- **WHEN** 一批资源在嵌套 Frame 或空白 Canvas 松手
- **THEN** external.drop effect 包含同一批资源、世界点和合法 parentId
- **AND** Engine 不读取 Blob 或构造 Component props

#### Scenario: 取消资源拖入

- **WHEN** 拖拽取消或未落在已连接 surface
- **THEN** preview 被清理且没有 drop effect
