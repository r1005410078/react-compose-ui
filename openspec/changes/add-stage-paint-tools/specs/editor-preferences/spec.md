## ADDED Requirements

### Requirement: Paint 吸管快捷键

Editor Preferences MUST 提供可配置的 `paint.eyedropper` 快捷键，默认 `I`。该快捷键只在 Color/Paint Picker 已打开的编辑上下文触发，且不得影响文本输入或普通 Stage tool。

#### Scenario: 在打开的 Picker 中触发吸管

- **WHEN** 背景 Paint 或 Solid Color Picker 打开且用户按下配置的吸管快捷键
- **THEN** 系统启动 native 或 Stage fallback 取色
- **AND** Picker 未打开时该键不改变 Stage 工具
