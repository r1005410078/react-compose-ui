## MODIFIED Requirements

### Requirement: ComposeDocument v4 ECS 预览

ComposePreview MUST 只接受 ComposeDocument v4，并按照 Transform、Visibility、Appearance、
Renderer、Hierarchy 和 Clip 渲染 Entity。Preview MUST 忽略 Lock、TransformConstraints、
Composition 和 canvas 编辑元数据。

#### Scenario: 预览 Renderer 与 Hierarchy 组合

- **WHEN** 文档包含可渲染 Container、嵌套 Container 和普通 Renderer Entity
- **THEN** Preview 按 rootIds/childIds 顺序渲染完整输出
- **AND** 与 Stage 非编辑内容保持一致

#### Scenario: 降级未知 Renderer

- **WHEN** Renderer type 当前未注册
- **THEN** Preview 仅显示对应可访问占位
- **AND** 其他 Entity 正常渲染
