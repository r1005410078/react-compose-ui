## ADDED Requirements

### Requirement: 平移帧的场景渲染范围

平移与缩放 MUST 只更新 DOM Scene 根节点的变换，MUST NOT 重建 Entity 内容子树。只在 viewport
变化时，Stage MUST NOT 遍历全部 Entity 重新计算世界包围盒。

#### Scenario: 平移只更新场景变换

- **WHEN** 只有 viewport 发生变化
- **THEN** 场景根节点的 transform 更新为新的平移与缩放
- **AND** Entity 渲染器不重新渲染

#### Scenario: 内容边界惰性求值

- **WHEN** Engine 已经发布滚动范围，用户继续平移
- **THEN** Stage 不再为兜底内容边界遍历全部 Entity
- **AND** 滚动条位置与范围与之前保持一致
