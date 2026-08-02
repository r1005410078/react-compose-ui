## MODIFIED Requirements

### Requirement: 语义 Component Inspector

基础材料 MUST 以 v5 Appearance.backgroundPaint 表达背景，默认值为明确的 Solid Paint。Appearance Inspector MUST 将背景作为 Paint editor，边框和 Renderer 文本/SVG 颜色继续使用 Solid Color editor，并把 Paint edit port 传给背景字段。

#### Scenario: 从 Inspector 创建渐变背景

- **WHEN** 用户编辑单个基础材料的背景并选择渐变
- **THEN** Materials 只更新该 Entity 的 Appearance.backgroundPaint
- **AND** 不向边框、文字、SVG 或 Shadow 写入 Gradient
