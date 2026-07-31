## ADDED Requirements

### Requirement: Component Inspector 标题栏 actions

ComposeComponentDefinition MUST 支持可选的 inspectorHeaderActions Renderer。Registry MUST 提供与
Component Inspector 正文相同的受控上下文和错误隔离适配器，使 Editor 可以按协议组合标题栏内容，
而不识别具体 Component Key。

#### Scenario: 解析 Component 标题栏 actions

- **WHEN** 当前 Entity 拥有一个声明 inspectorHeaderActions 的已注册 Component
- **THEN** Registry 适配器向 actions Renderer 传入 entity、componentKey、value、dispatch 和只读状态
- **AND** 未声明 actions、缺少 Component 数据或 actions 渲染失败时不会卸载完整 Inspector
