## ADDED Requirements

### Requirement: 图片背景渲染

Stage 与 Preview MUST 通过 ComposeAssetResolver 解析 Image Paint 的稳定引用，并按图片显示模式、透明度与叠色渲染。资源缺失或解析失败时 MUST 安全降级且继续渲染场景。

#### Scenario: 预览图片背景

- **WHEN** 文档输出或 Entity Appearance 使用可解析的 Image Paint
- **THEN** Preview 显示对应图片背景和颜色叠加
- **AND** 资源读取失败不会阻止其它实体显示
