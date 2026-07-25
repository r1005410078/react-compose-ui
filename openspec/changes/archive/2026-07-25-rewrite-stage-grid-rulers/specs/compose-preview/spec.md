## MODIFIED Requirements

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
