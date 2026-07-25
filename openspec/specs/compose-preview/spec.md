# compose-preview Specification

## Purpose
TBD - created by archiving change add-infinite-stage-composition. Update Purpose after archive.
## Requirements
### Requirement: 文档驱动的 Frame Preview

`@compose-ui/preview` MUST 接受 schemaVersion 2 ComposeDocument、ComponentRegistry 与显式 frameId，
并使用普通 DOM 按文档层级渲染目标 Frame。Preview MUST 忽略 document.canvas grid、snap 与 guides，
依赖 core 与 component-registry 公共入口，不得依赖 editor、stage、scene-tree 或 property-panel。

#### Scenario: 预览指定 Frame

- **WHEN** 宿主提供包含 canvas、多个 Frame 的合法 v2 文档、registry 和有效 frameId
- **THEN** Preview 只渲染目标 Frame 的可见后代
- **AND** 以 Frame 左上角为原点并裁剪到 Frame width/height

#### Scenario: 应用嵌套变换

- **WHEN** 目标 Frame 包含嵌套 Group、旋转和 Component
- **THEN** Preview 使用与 Stage 一致的局部层级得到相同内容几何
- **AND** 不渲染 selection、handles、rulers、axes、guides、grid 或 scrollbars

#### Scenario: 未知或失败 Renderer

- **WHEN** 目标 Frame 包含未知 componentType 或单个 renderer 抛出异常
- **THEN** 对应节点显示可访问错误占位
- **AND** 其余 Frame 内容继续渲染

### Requirement: Preview 配置与兼容

`ComposePreview` MUST 保留标准 section 属性与 legacy children 模式。仅当 document、registry、
frameId 全部提供时进入文档模式；三者均未提供时 MUST 渲染 children；只提供部分参数或 frameId
不存在时 MUST 显示可访问配置错误。

#### Scenario: 保留 legacy children

- **WHEN** 宿主不提供 document、registry 和 frameId
- **THEN** ComposePreview 与现有行为一样渲染 children
- **AND** 根 section 的 className、style、事件和 aria-label 继续透传

#### Scenario: 拒绝不完整文档配置

- **WHEN** 宿主只提供 document、registry、frameId 中的一部分
- **THEN** Preview 显示缺失配置的可访问说明
- **AND** 不猜测默认 Frame 或混合渲染 legacy children

#### Scenario: 拒绝未知 Frame

- **WHEN** frameId 不存在或指向非 Frame 节点
- **THEN** Preview 显示包含 frameId 的可访问错误
- **AND** 不渲染其他 Frame 作为隐式回退

### Requirement: Preview 节点样式一致性

ComposePreview MUST 使用与 Stage 相同的 resolved node style 渲染 Frame、Group 和 Component，
且 MUST NOT 引入 Stage 编辑覆盖层或依赖 stage 包。

#### Scenario: 预览统一节点样式

- **WHEN** 指定 Frame 子树包含通用 style
- **THEN** Preview 的背景、边框、圆角、透明度与 shadow 匹配 Stage 语义
- **AND** 无 style 的旧节点继续使用稳定 kind 默认值
