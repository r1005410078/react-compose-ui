## MODIFIED Requirements

### Requirement: 版本化 ECS JSON 文档

ComposeDocument v6 LayoutItem width/height MUST 接受 `fixed | fill | hug`。Hug MUST 允许用于 Renderer
leaf 或拥有 Layout 的 Hierarchy Entity；缺少 Layout 的 free Hierarchy Entity MUST NOT 使用 Hug。

#### Scenario: 校验 Hug 内容来源
- **WHEN** Renderer leaf、root Auto Layout container 或嵌套 Auto Layout container 使用 Hug axis
- **THEN** 文档通过校验并保留 fallback value/min/max
- **AND** free Hierarchy Entity 的 Hug 被返回到精确 axis path 的 issue 拒绝

