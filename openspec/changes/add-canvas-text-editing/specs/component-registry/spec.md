## ADDED Requirements

### Requirement: Renderer 原地文字编辑契约

Renderer Definition MAY 声明一个原地文字编辑契约，指明承载可编辑纯文本的 value prop 名称。Registry
MUST 校验该名称已在同一 Definition 中声明为 value contract，校验失败 MUST 按既有 Definition 拒绝路径
报告稳定错误。Registry MUST 让消费方仅凭 Entity 与 Registry 查出「是否可原地编辑」与「编辑哪个 prop」，
MUST NOT 要求消费方识别具体 Renderer type——Stage 不依赖物料包，不能按物料类型硬编码。

未声明该契约的 Renderer MUST 保持现状：不提供原地编辑入口，其 props 仍只能由 Inspector 编辑。

#### Scenario: 声明并查询可编辑文本 Prop

- **WHEN** Renderer Definition 把一个已声明的 value prop 标记为原地可编辑文本
- **THEN** Registry 允许注册，且消费方能按 Entity 查到该 prop 名称
- **AND** 未声明契约的 Renderer 查询结果为不可编辑

#### Scenario: 拒绝非法的编辑契约

- **WHEN** Definition 把 method prop、未声明的名称或不存在的 prop 标记为原地可编辑文本
- **THEN** Registry 拒绝该 Definition 并报告稳定错误
- **AND** 其他合法 Definition 不受影响
