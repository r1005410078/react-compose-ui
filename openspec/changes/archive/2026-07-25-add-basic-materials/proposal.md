# Change: 添加基础物料包与统一节点样式

## Why

当前 Rectangle 与 Text 只存在于示例应用，无法被宿主直接复用；Frame 也只能通过工具栏创建。
节点外观分散在 Stage CSS 和组件 props 中，Stage 与 Preview 缺少统一、可持久化的视觉协议。

## What Changes

- 新增 `@compose-ui/materials`，提供可组合的 Frame、Rectangle、Text 完整物料。
- 为全部 ComposeDocument 节点增加向后兼容的可选 `style`，并提供严格校验、默认解析和可逆命令。
- 扩展组件注册表，使组件种子可以提供默认节点样式。
- 扩展 Stage Palette 与拖拽控制器，使根级 Frame 可以从 Component Library 拖入。
- 让 Stage 与 Preview 使用相同节点样式语义。
- 让 editor controller 接收 Frame presets 与 Frame/Group Container Inspector。
- 完整示例迁移基础物料，保留 ECharts 作为宿主扩展示例。

## Impact

- 新包：`@compose-ui/materials`
- 修改包：core、component-registry、stage、preview、editor
- 修改示例、E2E、视觉黄金文件、README、项目约束、Changesets 与 pack 门禁
- `schemaVersion` 保持为 1；旧文档与旧 component drag API 保持兼容

## Dependencies

本变更依赖已完成的 `add-command-transaction-runtime` 与
`add-infinite-stage-composition`，归档时必须位于两者之后。
