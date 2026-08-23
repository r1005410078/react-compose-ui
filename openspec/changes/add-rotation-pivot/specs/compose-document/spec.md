## ADDED Requirements

### Requirement: Transform 承载可选的旋转基点

`Transform` Component MUST 支持可选的 `pivot` 字段，取值为**归一化盒坐标**的二维点。
缺席 MUST 等价于盒中心 `{ x: 0.5, y: 0.5 }`。

`pivot` MUST NOT 被钳制到 `[0, 1]`：基点落在盒外表达「绕一个外部支点摆动」，是正当用法。
坐标 MUST 是有限数字，`pivot` 自身 MUST 是二维点，未知字段 MUST 拒绝——写错名字的基点会
静默退回中心，用户只看到「基点没生效」。

协议版本 MUST NOT 因本字段变化，且 MUST NOT 需要迁移——没设过基点的文档在渲染与几何求解上
MUST 与本变更之前完全一致。

#### Scenario: 缺席时等价于盒中心

- **WHEN** 一个 Entity 的 `Transform` 没有 `pivot`
- **THEN** 它的旋转绕盒中心，与本变更之前的结果一致

#### Scenario: 基点可以落在盒外

- **WHEN** 设置一个坐标分量大于 1 的基点
- **THEN** 文档校验通过

#### Scenario: 坐标不是数字时非法

- **WHEN** 基点的某个坐标分量不是数字
- **THEN** 文档校验失败并给出 `transform.invalid`

#### Scenario: 未知字段被拒绝

- **WHEN** 基点带有 `x` / `y` 之外的字段
- **THEN** 文档校验失败
