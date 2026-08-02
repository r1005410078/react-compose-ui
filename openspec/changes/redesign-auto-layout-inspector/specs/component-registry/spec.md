## ADDED Requirements

### Requirement: 缺失 Component Inspector 协议

Component Definition MUST 能够声明 Component 缺失时的 Inspector 标题栏操作与可见条件。Editor
MUST 按 Registry 顺序组合该协议，不得硬编码具体 Component Key；锁定、文档、LayoutSnapshot 与
dispatch MUST 使用和普通 Component Inspector 相同的上下文。

#### Scenario: Hierarchy 缺少 Layout 时显示入口

- **WHEN** Materials 的 Layout Definition 检查拥有 Hierarchy 但缺少 Layout 的 Entity
- **THEN** Inspector 在 Layout 的 Registry 顺序位置显示“布局”操作行
- **AND** 非 Hierarchy Entity 与已经拥有 Layout 的 Entity 不显示重复入口

#### Scenario: 缺失入口继承只读上下文

- **WHEN** Entity 已锁定或宿主 Inspector 为只读
- **THEN** 缺失 Component 的操作收到 readOnly 状态并保持禁用
- **AND** Editor 不创建任何 Component 命令
