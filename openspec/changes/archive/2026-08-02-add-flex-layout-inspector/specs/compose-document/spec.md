## ADDED Requirements

### Requirement: 可选 Flex Layout Component

ComposeDocument MUST 支持只与 `Hierarchy` 组合的可选内建 `Layout` Component。首版 Layout MUST
使用 `type: "flex"`，并保存合法的 `flexDirection`、`flexWrap`、`alignContent`、
`justifyContent`、`alignItems` 与有限非负 `gap`。系统 MUST 发布独立默认值工厂与运行时校验器。

#### Scenario: 保存合法 Flex 布局

- **WHEN** 拥有 Hierarchy 的 Entity 保存浏览器支持的 Flex 容器枚举和有限非负 gap
- **THEN** v5 文档校验通过并原样保留 Layout JSON
- **AND** 默认值工厂返回 row、nowrap、normal 对齐与零 gap 的独立对象

#### Scenario: 拒绝非法 Layout

- **WHEN** Layout 使用未知 type、非法枚举、负数或非有限 gap，或所在 Entity 缺少 Hierarchy
- **THEN** 文档校验返回稳定 Layout issue 和对应字段路径
- **AND** 不静默纠正候选值

#### Scenario: 兼容缺少 Layout 的旧文档

- **WHEN** 合法 v5 Container 只有 Hierarchy 与可选 Clip 而没有 Layout
- **THEN** 文档继续校验通过且数据不被补写
- **AND** 现有 Transform、Stage 与 Preview 语义保持不变
