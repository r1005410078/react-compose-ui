## ADDED Requirements

### Requirement: 组件默认节点样式

ComponentDefinition MAY 提供返回 NodeStyle 的 factory。Registry MUST 在每次 createSeed 时返回
独立 style，并 MUST 拒绝 factory 异常或非法 style；未提供 factory 的现有 definition MUST
保持原行为。

ComponentDefinition MAY 另外提供非空 `defaultName`；seed MUST 带上该名称，省略时 MUST 回退
到 definition label，使 materials 可以分别覆盖 Palette label 与文档节点 name。

#### Scenario: 创建带独立 style 的组件种子

- **WHEN** definition 连续创建两个带默认 style 的 seed
- **THEN** 两个 seed 的业务值相同但不共享可变 style 或 shadow
- **AND** 原有 props 独立性保持不变

#### Scenario: 拒绝非法默认 style

- **WHEN** style factory 抛出异常或返回非法 style
- **THEN** createSeed 返回稳定错误且不产生部分 seed

### Requirement: 通用节点 Inspector 上下文

Registry 公共协议 MUST 提供只读 NodeInspectorProps，使独立包可以对 Frame、Group 或 Component
派发结构化命令；现有 ComponentInspectorProps MUST 保持兼容。

#### Scenario: 组合结构节点 Inspector

- **WHEN** 宿主把独立 Node Inspector 提供给 editor controller
- **THEN** Inspector 收到只读节点和统一 dispatch
- **AND** 不需要依赖 editor 内部类型或直接修改文档
