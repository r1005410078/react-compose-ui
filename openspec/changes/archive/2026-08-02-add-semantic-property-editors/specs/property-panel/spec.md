## ADDED Requirements

### Requirement: 内建语义属性编辑器

`@compose-ui/property-panel` MUST 内建并公开稳定 editor ID `vector2`、`size`、`angle`、`opacity`、`corner-radius`、`stroke-width`、`visibility`、`color`、`alignment`、`map`。面板 MUST 自动将这些 editor 与 metadata 匹配；实例级 renderer 使用相同 ID 时 MUST 优先于内建 renderer，且 registry 不得使用模块级可变状态。Renderer props MUST 提供字段显示名，以便维持可访问名称与本地化文案。

#### Scenario: 自动使用内建 editor
- **WHEN** 同步 Valibot Schema 的字段 metadata 指定一个内建 editor ID
- **THEN** 属性面板使用对应的语义编辑器，并继续通过统一完整 Schema 校验提交受控候选值
- **AND** 只读、无效草稿、重置、键盘焦点和现有变量绑定行为保持有效

#### Scenario: 宿主覆盖内建 editor
- **WHEN** 实例传入与内建 editor ID 相同的 renderer
- **THEN** 该实例使用宿主 renderer 而不是内建 renderer
- **AND** 其他内建 editor 继续对该实例自动可用

#### Scenario: 复合值分别绑定
- **WHEN** 已启用绑定的 Vector2 或 Size editor 显示可编辑的复合值
- **THEN** Vector2 暴露稳定的 X/Y 子目标，Size 暴露稳定的 W/H 子目标
- **AND** 每个未绑定子目标仍可独立编辑其字面值

#### Scenario: UE4 式紧凑复合值布局
- **WHEN** 属性面板显示 Vector2 或没有 Size preset 的 Size editor
- **THEN** 字段名称留在左侧属性列，X/Y 或 W/H 留在右侧同一 property row
- **AND** editor 不得为了复合值创建全宽的第二行

### Requirement: 单键分支 Map

Map editor MUST 只接受 `v.variant('key', [...])`，每个分支 MUST 精确为 `{ key: v.literal(string), value: schema }`。Key MUST 渲染在属性左列，Value MUST 在同一 property row 的右列复用其分支 Schema 对应的内建或实例 renderer。动态键集合 MUST 继续使用既有 `record`，不得被 Map 改写。

#### Scenario: 选择 Map Key 并复用分支 Value
- **WHEN** Map 的 Key 从一个有效分支切换到另一个有效分支
- **THEN** 面板使用 `mapValueDefaults` 或分支 Schema 初值构造完整、通过校验的候选值
- **AND** 左列显示当前 Key，右列显示该分支 Value editor，且不创建嵌套 property row

#### Scenario: Map 的只读、覆盖与错误契约
- **WHEN** Map 只读、宿主按 `map` ID 覆盖 renderer，或 Schema 不符合 Map 契约
- **THEN** Key 和 Value 分别遵守只读或宿主覆盖行为
- **AND** 不符合契约时显示错误且不允许错误写入

### Requirement: Size 预设与 Color Picker

Property panel metadata MUST 支持为 Size editor 声明预设 ID、宽度和高度。Size schema 包含 preset picklist 时，editor MUST 在同一个属性内容区显示 preset 与 W/H。Color editor MUST 使用共享 `ComposeColorPicker`，属性行和弹层不得显示 CSS 颜色字符串；既有非 HEX CSS 色在用户未修改时仍必须保持原值。

#### Scenario: 选择并退出 Size 预设
- **WHEN** 用户在一个 Size 属性中选择有效预设
- **THEN** preset、宽度和高度在一次有效提交中同步更新
- **WHEN** 用户手动编辑宽度或高度且组合不再匹配预设
- **THEN** preset 变为 schema 所允许的 custom 值

#### Scenario: 通过 Picker 兼容非 HEX CSS Color
- **WHEN** Color 属性当前值为 `transparent`、`rgb()` 或 `hsl()` 文本
- **THEN** 属性行只显示 Color Picker 色块，且原值在用户未修改时不被重写
- **AND** Picker 从安全 fallback 色开始，用户重新选择颜色后才提交小写 HEX 或 `transparent`
