## ADDED Requirements

### Requirement: 物料样式不依赖属性面板内部类名

基础物料的 Inspector 样式 MUST NOT 引用 `property-panel__` 前缀的内部类名，MUST 改用
`data-property-part` 与 `data-property-*` 字段属性定位属性面板结构。

#### Scenario: Auto Layout Inspector 重排属性面板

- **WHEN** Auto Layout Inspector 把属性面板重排为两列紧凑网格并去掉字段外壳
- **THEN** 相关选择器只使用受支持的 data 属性
- **AND** Inspector 的视觉结果与迁移前保持一致

#### Scenario: 护栏阻止再次引入内部类名

- **WHEN** 有人在 materials 样式表里写下 `property-panel__` 前缀选择器
- **THEN** materials 的样式契约测试失败并指出应改用 `data-property-part`
