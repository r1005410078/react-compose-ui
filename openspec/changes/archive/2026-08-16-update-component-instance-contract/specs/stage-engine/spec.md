## ADDED Requirements

### Requirement: 组件提取复用已有单根

提取器 MUST 在选区是单个未锁定顶层节点时直接复用该节点作为组件根，不追加 Group 包装；只有多选或
需要统一归零坐标时才创建 Group 根。两种路径 MUST 都保持后代世界几何、旋转与 sibling 顺序不变。

#### Scenario: 单选容器不产生冗余层级

- **WHEN** 用户对单个 Container 或 Group 创建组件
- **THEN** 组件文档以该节点为唯一根
- **AND** 场景树中不出现额外的同名包装层

#### Scenario: 多选仍生成 Group 根

- **WHEN** 用户对两个及以上同父级顶层节点创建组件
- **THEN** 提取器创建 Group 根并把选区作为其子项
- **AND** 所有后代的世界几何保持不变
