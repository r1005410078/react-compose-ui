## ADDED Requirements

### Requirement: Preview 节点样式一致性

ComposePreview MUST 使用与 Stage 相同的 resolved node style 渲染 Frame、Group 和 Component，
且 MUST NOT 引入 Stage 编辑覆盖层或依赖 stage 包。

#### Scenario: 预览统一节点样式

- **WHEN** 指定 Frame 子树包含通用 style
- **THEN** Preview 的背景、边框、圆角、透明度与 shadow 匹配 Stage 语义
- **AND** 无 style 的旧节点继续使用稳定 kind 默认值
