## MODIFIED Requirements

### Requirement: Compose Color/Paint Picker 与会话颜色历史

ComposeColorPicker MUST 编辑带 Alpha 的 Solid ComposeColor；ComposePaintPicker MUST 编辑结构化 ComposePaint。
Paint Picker MUST 在单个紧凑 Theme/I18n Popover 内呈现 Solid/Gradient 类型、当前色标和其内嵌的 Hue、
Alpha、透明、最近色、常用色与默认折叠的 HEX/RGB 精确区，不得为色标再打开第二个 Color Popover。
Color History Provider MUST 支持受控/非受控 MRU，最多保留 16 个值，且不写 localStorage 或文档。

#### Scenario: 在同一面板编辑渐变色标

- **WHEN** 用户在打开的 Paint Picker 中由 Solid 切换至任一 Gradient，并选择一个色标
- **THEN** 同一 Popover 内的色盘、Hue、Alpha 和调色板编辑该色标
- **AND** 不出现嵌套的 Color Picker dialog

#### Scenario: 选择半透明常用色

- **WHEN** 用户调整 Alpha 或选择常用色后关闭 Picker
- **THEN** 当前受控值规范化并更新最近色
- **AND** 节点 opacity 不受影响
