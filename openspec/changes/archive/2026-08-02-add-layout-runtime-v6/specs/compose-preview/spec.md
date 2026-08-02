## RENAMED Requirements

- FROM: `### Requirement: ComposeDocument v4 ECS 预览`
- TO: `### Requirement: 独立只读 Preview`

## MODIFIED Requirements

### Requirement: 独立只读 Preview

ComposePreview MUST 只接受 ComposeDocument v6，并通过 Layout Runtime Snapshot 渲染完整输出或指定
Container。Preview 与 Stage MUST 对同一文档和测量环境输出相同 local box，且不得依赖 Stage。

#### Scenario: Preview 与 Stage 布局一致
- **WHEN** 文档包含嵌套 Fixed Flex、Absolute 子项、padding、gap、border 与 rotation
- **THEN** Preview 和 Stage 为每个 Entity 输出相同 parent-local left/top/width/height
- **AND** Preview DOM 不使用 CSS Flex 重新计算布局

## ADDED Requirements

### Requirement: 完整文档与指定 Container 预览

Container target 的 viewport MUST 使用目标 Entity 的 resolved width/height，而不是读取旧 Transform
size；目标缺失、不是 Hierarchy 或布局 Runtime error 时 MUST 显示明确 alert。

#### Scenario: 预览 Auto Layout Container
- **WHEN** target 指向尺寸由 Layout Snapshot 解析的 Container
- **THEN** Preview 以其 resolved border box 建立相对 viewport 并渲染后代
- **AND** 不把目标在父级中的 offset 重复应用到 viewport

