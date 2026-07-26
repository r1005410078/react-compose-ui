# compose-preview Specification

## Purpose
TBD - created by archiving change add-infinite-stage-composition. Update Purpose after archive.
## Requirements
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

### Requirement: Preview 节点样式一致性

ComposePreview MUST 使用与 Stage 相同的 resolved node style 渲染 Frame、Group 和 Component，
且 MUST NOT 引入 Stage 编辑覆盖层或依赖 stage 包。

#### Scenario: 预览统一节点样式

- **WHEN** 指定 Frame 子树包含通用 style
- **THEN** Preview 的背景、边框、圆角、透明度与 shadow 匹配 Stage 语义
- **AND** 无 style 的旧节点继续使用稳定 kind 默认值
