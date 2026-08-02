## MODIFIED Requirements

### Requirement: 版本化 ECS JSON 文档

系统 MUST 只接受 `schemaVersion: 5` 的严格 JSON ComposeDocument，并拒绝 v4 或其它版本。每个 Entity 必须拥有 Composition、Transform、Visibility 与 Lock，并至少拥有 Renderer 或 Hierarchy。未知 PascalCase Component 继续保留。

Appearance 的背景 MUST 使用可选 `backgroundPaint: ComposePaint`；`backgroundColor` 在 v5 Appearance 中 MUST 被拒绝。缺失 Paint 解析为透明 Solid。ComposePaint 必须是 Solid、Linear、Radial 或 Angular；Gradient 有 2–8 个唯一 ID 的 stop，所有位置/坐标有限，stop position 位于 0–1，半径为正，angle 规范化为 0–360。borderColor、shadow color 与 output.backgroundColor 保持 ComposeColor 字符串，不得保存 Gradient。

#### Scenario: 保存可编辑渐变背景

- **WHEN** v5 Entity Appearance 保存合法 Linear、Radial 或 Angular backgroundPaint
- **THEN** 文档校验保留其归一化几何与 stop
- **AND** 缺失 backgroundPaint 的 Appearance 解析为透明 Solid

#### Scenario: 拒绝旧版本和旧背景字段

- **WHEN** 输入 schemaVersion 4 或 Appearance 含 backgroundColor
- **THEN** 文档校验以稳定问题拒绝该文档
- **AND** 系统不提供自动迁移或兼容 facade
