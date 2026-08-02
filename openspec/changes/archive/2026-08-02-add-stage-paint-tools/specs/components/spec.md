## ADDED Requirements

### Requirement: Compose Color/Paint Picker 与会话颜色历史

ComposeColorPicker MUST 编辑带 Alpha 的 Solid ComposeColor；ComposePaintPicker MUST 编辑结构化 ComposePaint。二者均显示 368–400px 的 Theme/I18n Popover、Hue、Alpha、透明操作、常用色、最近色与默认折叠的 HEX/RGB 精确区。Color History Provider MUST 支持受控/非受控 MRU，最多保留 16 个值，且不写 localStorage 或文档。

#### Scenario: 选择半透明常用色

- **WHEN** 用户调整 Alpha 或选择常用色后关闭 Picker
- **THEN** 当前受控值规范化并更新最近色
- **AND** 节点 opacity 不受影响

### Requirement: 用户意图驱动的吸管

Picker MUST 只在用户点击或快捷键激活时调用 native EyeDropper，并通过 AbortSignal 处理 Escape、卸载或字段切换。API 不可用或失败时 MUST 经受控 fallback port 请求 Stage 采样，且不静默丢失当前值。

#### Scenario: 原生吸管不可用

- **WHEN** 浏览器不提供 EyeDropper
- **THEN** Picker 进入宿主提供的 Stage 采样模式
- **AND** 取消采样后恢复原值和焦点
