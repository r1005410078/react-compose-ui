## MODIFIED Requirements

### Requirement: 可配置单次快捷键

编辑器 MUST 保留现有可配置 Stage 动作和默认键位。`stage.fitFrame` MUST 从当前选择或最近 Frame
祖先推导目标；`edit.group`/`edit.ungroup` MUST 操作统一 Frame，不依赖 Group 节点或
activeFrameId。

#### Scenario: 使用选择推导的 Frame 快捷键

- **WHEN** 用户选择 Frame 后代并触发适配 Frame
- **THEN** Stage 适配最近 Frame 祖先
- **AND** 根 Component 没有 Frame 祖先时动作稳定 no-op

#### Scenario: 使用组合快捷键

- **WHEN** 用户在 Canvas 根选择多个节点并触发 group/ungroup
- **THEN** 快捷键分别创建或解除统一 Frame
- **AND** 默认键位和可配置冲突规则保持不变
