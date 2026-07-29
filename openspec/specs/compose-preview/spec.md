# compose-preview Specification

## Purpose
TBD - created by archiving change add-infinite-stage-composition. Update Purpose after archive.
## Requirements
### Requirement: Preview 配置与兼容

document 与 registry MUST 成对提供；target 只能在文档模式使用。三者均未提供时 MUST 保留
legacy children；旧 frameId prop MUST 被删除，未知或非 Frame target MUST 显示可访问错误。

#### Scenario: 拒绝无效 target 配置

- **WHEN** 宿主缺少 document/registry、单独提供 target 或 target 指向 Component
- **THEN** Preview 显示明确配置错误且不回退到其他 Frame

### Requirement: Preview 资源解析

ComposePreview MUST 接受可选 assetResolver，并把它传给文档或 Frame target 内所有 Component
renderer；资源 chrome MUST NOT 出现在输出中。

#### Scenario: 预览资源组件

- **WHEN** 文档包含 Image/SVG 节点且 resolver 可用
- **THEN** document 与 frame target 都渲染最新资源
- **AND** 缺失 resolver 时只显示节点内可访问占位而不卸载 Preview

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

