## ADDED Requirements

### Requirement: 场景树内建本地化

SceneTree MUST 接受可选 zh-CN 或 en-US locale，并在未提供时保持 zh-CN。检索、空状态、菜单、
操作名称、错误和 ARIA 文案 MUST 来自完整内建词典；节点 label MUST 保持宿主值。

#### Scenario: 使用英文场景树

- **WHEN** 宿主以 en-US 挂载 SceneTree 并打开检索与命令菜单
- **THEN** 内建控件、状态、菜单和可访问名称显示英文
- **AND** 节点 label 不被翻译

#### Scenario: 独立使用默认语言

- **WHEN** 宿主独立挂载 SceneTree 且不提供 locale
- **THEN** 现有简体中文内建文案和行为保持不变
