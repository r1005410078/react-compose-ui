## MODIFIED Requirements

### Requirement: ComposeDocument v4 ECS 预览

ComposePreview MUST 只接受 ComposeDocument v5，并通过共享 Entity Paint layer 渲染 Appearance.backgroundPaint。Preview 继续忽略编辑 chrome、Paint overlay、网格、标尺和取色会话。

#### Scenario: 预览三种渐变

- **WHEN** v5 文档包含 Linear、Radial 或 Angular 背景 Paint
- **THEN** Preview 与 Stage 的实体背景一致
- **AND** Preview 不渲染编辑控制柄或采样浮层
