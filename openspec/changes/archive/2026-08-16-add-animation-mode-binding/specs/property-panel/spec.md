## ADDED Requirements

### Requirement: 字段标签装饰插槽

`ComposePropertyPanel` MUST 支持可选的 `renderFieldAdornment` 插槽，在每个字段标签文本之后渲染
宿主返回的节点。插槽 MUST 收到该字段的 `path`、`schema`、`metadata`、`label` 与当前 `value`，
并 MUST 在自定义 renderer、内建语义 editor 与基础 primitive 三种字段上一致生效。
装饰节点 MUST 渲染在 `data-property-part="adornment"` 容器内，且 MUST NOT 占用右侧动作栏的容量。
插槽返回 `null` 或未提供该属性时，字段行 MUST 与现在完全一致。

#### Scenario: 在语义 editor 字段上渲染装饰

- **WHEN** 宿主提供 `renderFieldAdornment` 并渲染一个包含 Vector2 与 Color 字段的 Schema
- **THEN** 两个字段的标签后都出现宿主节点
- **AND** 每次调用收到的 `path` 分别是该字段自己的路径

#### Scenario: 装饰不挤占动作栏

- **WHEN** 一个字段同时具有重置动作、绑定入口与宿主装饰
- **THEN** 重置与绑定仍显示在右侧动作栏中，不因为装饰而进入溢出菜单

#### Scenario: 未提供插槽时行为不变

- **WHEN** 宿主不传 `renderFieldAdornment`
- **THEN** 字段行不渲染 `data-property-part="adornment"` 容器
