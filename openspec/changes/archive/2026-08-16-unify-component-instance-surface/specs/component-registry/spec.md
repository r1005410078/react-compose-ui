## MODIFIED Requirements

### Requirement: Stage 与 Preview 共享 Entity 视觉样式

系统 MUST 提供 composeEntityVisualStyle 与 composeEntitySceneStyle，把 Appearance、Clip 与
Transform 解析为一致的盒样式；Stage 与 Preview MUST 使用同一实现渲染 Entity 盒。
component-instance 嵌套文档中的实体渲染 MUST 在 Appearance 与 overflow/clip 语义上与上述
实现一致：叶子 Entity MUST 使用 hidden overflow，使 borderRadius 裁剪内部 Paint 与 Material
层；容器 Entity MUST 按 resolveComposeOverflow 映射分轴 overflow，不得省略导致圆角或裁剪与
Stage 不一致。

#### Scenario: 边框与阴影合成一致的 boxShadow

- **WHEN** Entity Appearance 同时含边框与 shadow
- **THEN** Stage 与 Preview 得到相同的 inset 边框加投影 boxShadow 与 Clip 决定的 overflow

#### Scenario: 嵌套实例叶子裁剪圆角

- **WHEN** 叶子 Entity 含非零 borderRadius，并在 component-instance 嵌套路径中渲染
- **THEN** 该实体盒 overflow 为 hidden
- **AND** 其 Appearance 填色与圆角与 Stage 渲染同构 Entity 时一致

## ADDED Requirements

### Requirement: 共享 Entity overflow 解析辅助

系统 MUST 提供可被 Stage、Preview 与 component-instance 嵌套渲染复用的 overflow 样式解析（纯函数或等价共享模块），输入 Entity，输出与 resolveComposeOverflow 语义一致的 CSS overflow 结果。各消费方 MUST NOT 各自维护互相漂移的第三套 overflow 规则。

#### Scenario: 三路径使用同一 overflow 语义

- **WHEN** 同一 Container Entity 配置分轴 clip/scroll/visible
- **THEN** Stage、Preview 与 component-instance 嵌套路径得到等价的 overflowX/overflowY 映射
