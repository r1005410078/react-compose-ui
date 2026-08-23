## MODIFIED Requirements

### Requirement: Stage 与 Preview 共享 Entity 视觉样式

系统 MUST 提供 composeEntityVisualStyle 与 composeEntitySceneStyle，把 Appearance、Clip 与
Transform 解析为一致的盒样式；Stage 与 Preview MUST 使用同一实现渲染 Entity 盒。
component-instance 嵌套文档中的实体渲染 MUST 在 Appearance 与 overflow/clip 语义上与上述
实现一致：叶子 Entity MUST 使用 hidden overflow，使 borderRadius 裁剪内部 Paint 与 Material
层；容器 Entity MUST 按 resolveComposeOverflow 映射分轴 overflow，不得省略导致圆角或裁剪与
Stage 不一致。

场景样式的 `transform-origin` MUST 由该 Entity 的旋转基点算出，MUST NOT 写死居中。Stage
Scene、Preview 与组件实例三条渲染路径共用同一个场景样式入口，因此本要求 MUST 由这一个入口
满足，MUST NOT 在各渲染路径分别实现。

#### Scenario: 边框与阴影合成一致的 boxShadow

- **WHEN** Entity Appearance 同时含边框与 shadow
- **THEN** Stage 与 Preview 得到相同的 inset 边框加投影 boxShadow 与 Clip 决定的 overflow

#### Scenario: 嵌套实例叶子裁剪圆角

- **WHEN** 叶子 Entity 含非零 borderRadius，并在 component-instance 嵌套路径中渲染
- **THEN** 该实体盒 overflow 为 hidden
- **AND** 其 Appearance 填色与圆角与 Stage 渲染同构 Entity 时一致

#### Scenario: 基点反映到变换原点

- **WHEN** 一个 Entity 的基点位于左边中点
- **THEN** 它的场景样式变换原点为左边中点

#### Scenario: 未设基点仍然居中

- **WHEN** 一个 Entity 没有设置基点
- **THEN** 它的场景样式变换原点为居中
