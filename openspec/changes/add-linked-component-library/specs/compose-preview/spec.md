## ADDED Requirements

### Requirement: 组件实例预览
Preview MUST 从实例内嵌快照递归渲染组件内容并保留内部 Renderer 的真实预览交互，不依赖实时 Component Store。

#### Scenario: 预览项目组件实例
- **WHEN** 文档包含已保存的 component-instance 快照
- **THEN** Preview 按快照与 overrides 渲染内容且允许内部预览交互
