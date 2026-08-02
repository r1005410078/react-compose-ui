## MODIFIED Requirements

### Requirement: 固定原点输出设置

ComposeDocument MUST 保存正有限 width/height 与合法 `backgroundPaint: ComposePaint` 的 output，并导出默认
`1280×720`、透明 Solid Paint 的 `createDefaultOutputSettings()`。输出原点 MUST 固定为世界 `(0,0)`；
`output.backgroundColor` MUST 在 v5 中被拒绝，系统不得提供双字段或自动迁移。

#### Scenario: 校验结构化输出背景

- **WHEN** 宿主创建默认输出，或提供含合法 Solid、Linear、Radial 或 Angular Paint 的自定义输出
- **THEN** 文档校验通过且值可 JSON 往返
- **AND** 非正、非有限尺寸、非法 Paint 或 `backgroundColor` 旧字段被拒绝
