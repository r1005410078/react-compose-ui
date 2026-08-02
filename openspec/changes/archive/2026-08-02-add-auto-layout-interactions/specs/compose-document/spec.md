## MODIFIED Requirements

### Requirement: 版本化 ECS JSON 文档

ComposeDocument v6 LayoutItem width/height MUST 接受 `fixed | fill` axis sizing。每个 axis MUST 保存
有限正 value、非负 min 与 null 或不小于 min 的 max。Fill MUST 只允许在 Layout parent 的 Flow
直接子项上。

#### Scenario: 校验 Fill 参与条件
- **WHEN** Flow 子项在 Layout parent 下使用一个或两个 Fill axis
- **THEN** 文档通过校验且 sizing 原样保留
- **AND** Absolute、root 或 free parent 的 Fill 被返回到精确 axis path 的 issue 拒绝

