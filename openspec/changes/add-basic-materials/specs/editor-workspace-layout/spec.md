## ADDED Requirements

### Requirement: Frame presets 与结构节点 Inspector

useComposeEditorController MUST 接受可选 Frame presets 与 Container Inspector。默认 Component
Library MUST 把 Frame presets 放在 registry definitions 前；单选 Frame/Group 时 MUST 使用
Container Inspector，单选 Component 时 MUST 继续优先使用 definition Inspector。

#### Scenario: 默认工作区组合基础物料

- **WHEN** 宿主向 controller 提供 materials registry、Frame presets 与 Container Inspector
- **THEN** 默认工作区显示可拖拽 Frame 和全部 registry components
- **AND** Frame/Group 与 Component 选择显示各自正确 Inspector

#### Scenario: 保持未配置宿主兼容

- **WHEN** 宿主不提供 Frame presets 或 Container Inspector
- **THEN** 现有 Palette、Stage Toolbar Frame 按钮和空结构 Inspector 行为保持不变
