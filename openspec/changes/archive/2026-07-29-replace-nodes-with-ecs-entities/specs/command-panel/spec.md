## ADDED Requirements

### Requirement: ECS 命令调试

Command Panel MUST 展示并重放 v4 Entity、Component、Transform 和 Capability batch 命令，不得
继续提供旧 node/frame 预设。复制 JSON、重放 ID/source 规则和清空会话行为保持不变。

#### Scenario: 查看能力 batch

- **WHEN** Inspector 添加或移除能力
- **THEN** Command Panel 显示一个包含 Component 与 Composition 修改的 committed batch
- **AND** 重放仍产生新 command ID 且遵守当前文档校验
