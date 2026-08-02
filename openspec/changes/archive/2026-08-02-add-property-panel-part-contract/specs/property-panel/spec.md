## ADDED Requirements

### Requirement: 结构 Part 样式契约

属性面板 MUST 为结构容器输出稳定的 `data-property-part` 属性，取值覆盖 `toolbar`、`separator`、
`fields`、`ungrouped`、`field`、`label`、`editor`、`actions` 与 `control`。该属性 MUST 作为公开样式
契约维护：内部 BEM 类名 MUST NOT 被当作外部可依赖的选择器，消费方 MUST 只通过 `data-property-part`
与既有 `data-property-*` 字段属性定位结构。

#### Scenario: 领域包重排字段外壳

- **WHEN** 领域包需要把属性面板重排为多列网格、隐藏工具栏或去掉字段外壳
- **THEN** 该包只使用 `data-property-part` 与 `data-property-path` 定位结构
- **AND** 不需要引用任何 `property-panel__` 前缀类名

#### Scenario: 内部类名重构不破坏消费方

- **WHEN** property-panel 调整内部 BEM 类名或容器嵌套层级
- **THEN** `data-property-part` 取值与所在元素保持不变
- **AND** 依赖该契约的领域样式继续生效
