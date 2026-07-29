## MODIFIED Requirements

### Requirement: 可配置单次快捷键

编辑器 MUST 保留现有可配置 Stage 动作和默认键位。`stage.fitContainer` MUST 从当前选择或最近
Container 祖先推导目标；`edit.group`/`edit.ungroup` MUST 操作统一 Container，不依赖旧 Frame
节点或 activeFrameId。

#### Scenario: 使用选择推导的 Container 快捷键

- **WHEN** 用户选择 Container 后代并触发适配 Container
- **THEN** Stage 适配最近 Container 祖先
- **AND** 根 Renderer Entity 没有 Container 祖先时动作稳定 no-op

#### Scenario: 使用组合快捷键

- **WHEN** 用户在 Canvas 根选择多个 Entity 并触发 group/ungroup
- **THEN** 快捷键分别创建或解除统一 Container
- **AND** 默认键位和可配置冲突规则保持不变
