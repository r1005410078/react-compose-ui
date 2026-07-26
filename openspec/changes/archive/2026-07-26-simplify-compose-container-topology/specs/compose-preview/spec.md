## MODIFIED Requirements

### Requirement: 文档驱动的 Frame Preview

ComposePreview MUST 接受 v3 document、registry 与可选 target。省略 target 时 MUST 以 output
背景和尺寸渲染所有根节点；`{ kind: 'frame', frameId }` MUST 以任意根级或嵌套 Frame 为局部
原点渲染其内容。两种最外层输出都 MUST 裁剪。

#### Scenario: 预览完整文档

- **WHEN** 宿主只提供合法 document 与 registry
- **THEN** Preview 使用 output 尺寸和背景渲染全部可见根节点
- **AND** 负坐标或越界内容被输出边界裁剪
- **AND** 默认 output 透明且不会由 Preview 注入编辑器棋盘格或实色背景

#### Scenario: 预览嵌套 Frame

- **WHEN** target 指向旋转父级内的嵌套 Frame
- **THEN** Preview 忽略目标自身世界位置和 rotation，以其左上角作为输出原点
- **AND** 目标外层始终裁剪，后代 Frame 按各自 clipContent 渲染

### Requirement: Preview 配置与兼容

document 与 registry MUST 成对提供；target 只能在文档模式使用。三者均未提供时 MUST 保留
legacy children；旧 frameId prop MUST 被删除，未知或非 Frame target MUST 显示可访问错误。

#### Scenario: 拒绝无效 target 配置

- **WHEN** 宿主缺少 document/registry、单独提供 target 或 target 指向 Component
- **THEN** Preview 显示明确配置错误且不回退到其他 Frame
