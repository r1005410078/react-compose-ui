## ADDED Requirements

### Requirement: 几何 Inspector 提供旋转基点

几何分组 MUST 提供「旋转基点」字段，v1 MUST 以九个锚点（四角、四边中点、中心）呈现。

文档字段 MUST 保持自由二维点：UI 的取值约束 MUST NOT 上升为协议的约束，将来补自定义数值
输入或画布手柄时 MUST NOT 需要改动协议。

基点写入 MUST 走通用的 Component 更新命令，MUST NOT 塞进承载位置/尺寸/旋转的几何变换命令
——后者的载荷是 Stage 几何编辑的合成值，本来就没有基点的位置。

#### Scenario: 选择锚点写入基点

- **WHEN** 在几何分组把旋转基点选为左边中点
- **THEN** 该 Entity 的 `Transform.pivot` 为左边中点，且可撤销

#### Scenario: 未设基点时显示为中心

- **WHEN** 选中一个没有设置基点的 Entity
- **THEN** 旋转基点显示为中心
