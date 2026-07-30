## ADDED Requirements

### Requirement: Preview 输出背景 Paint

ComposePreview MUST 在固定输出边界渲染 `output.backgroundPaint` 的 Solid、Linear、Radial 与 Angular
描述，并保持其位于所有 Entity 之后。Preview 不得渲染渐变编辑控制柄或其它 Editor chrome。

#### Scenario: 预览渐变输出背景

- **WHEN** v5 document output 使用任一合法 Gradient Paint
- **THEN** Preview 显示与 Stage 输出边界一致的渐变背景
- **AND** Entity Appearance、Hierarchy 和 Clip 渲染顺序保持不变
