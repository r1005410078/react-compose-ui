## ADDED Requirements

### Requirement: 共享 Entity Paint Layer 与 Inspector Port

Registry MUST 提供 Stage 与 Preview 共用的 Entity Paint layer。Solid、Linear、Radial、Angular 必须从同一 Core Paint descriptor 渲染，且 layer 不影响 Renderer 或 Hierarchy 子项的 pointer 目标。Registry MUST 定义无 Editor/Stage 依赖的 ComposePaintEditPort，供 Component Inspector 请求激活、退出和采样背景 Paint。

#### Scenario: Stage 与 Preview 渲染同一 Paint

- **WHEN** Entity 使用任意支持的 backgroundPaint
- **THEN** Stage 与 Preview 使用相同 descriptor 和视觉渐变
- **AND** Inspector 只能通过 Port 发出 Paint 编辑意图
