## ADDED Requirements

### Requirement: 内建 Inspector 提供重置基线

内建 Component Inspector 与 Renderer Inspector MUST 向 `ComposePropertyPanel` 传入稳定的
`defaultValue`，使属性行的重置动作与“已修改”筛选可用。基线 MUST 由 Component/Renderer
Definition 的默认值派生，MUST 能通过该 Inspector 自身的 schema 校验，且 MUST NOT 依赖当前
受控 value。没有与实例无关默认值的字段（如位置、尺寸）MUST NOT 出现在基线中。

#### Scenario: 修改背景填充后出现重置

- **WHEN** 用户把某个基础物料的 Appearance 背景填充改为与默认 Solid Paint 不同的值
- **THEN** 该属性行的操作列显示重置动作
- **AND** 执行重置后 Appearance 背景恢复为定义中的默认 Solid Paint

#### Scenario: 属性等于默认值时不显示重置

- **WHEN** 某属性的当前值与其基线深度相等且该属性没有后代绑定
- **THEN** 该属性行不显示重置动作

#### Scenario: 位置与尺寸不参与重置

- **WHEN** 用户在几何 Inspector 中修改位置或尺寸
- **THEN** 这两个字段不显示重置动作
- **AND** 同一 Inspector 中的旋转与外边距在偏离默认值时仍显示重置动作

#### Scenario: 重置 Renderer 属性保留 schema 之外的字段

- **WHEN** Renderer props 含 schema 未覆盖的宿主字段且用户重置某个 schema 内属性
- **THEN** 派发的 props 中该属性恢复为 Definition 默认值
- **AND** 宿主扩展字段保持不变
