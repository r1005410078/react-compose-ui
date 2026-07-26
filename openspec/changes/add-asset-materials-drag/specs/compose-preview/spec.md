## ADDED Requirements

### Requirement: Preview 资源解析

ComposePreview MUST 接受可选 assetResolver，并把它传给文档或 Frame target 内所有 Component
renderer；资源 chrome MUST NOT 出现在输出中。

#### Scenario: 预览资源组件

- **WHEN** 文档包含 Image/SVG 节点且 resolver 可用
- **THEN** document 与 frame target 都渲染最新资源
- **AND** 缺失 resolver 时只显示节点内可访问占位而不卸载 Preview
