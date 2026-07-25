## ADDED Requirements

### Requirement: 命令面板内建本地化

CommandPanel MUST 接受可选 zh-CN 或 en-US locale，并在未提供时保持 zh-CN。标题、状态、详情、
表单验证、空状态和 ARIA 文案 MUST 使用内建词典；命令 label/type、source、字段 label 与 select
选项 MUST 保持宿主值。

#### Scenario: 使用英文命令面板

- **WHEN** 宿主以 en-US 挂载 CommandPanel 并查看事件或预设表单
- **THEN** 内建 chrome、状态、验证和可访问名称显示英文
- **AND** 宿主命令与预设字段文案不被翻译

#### Scenario: 独立使用默认语言

- **WHEN** 宿主独立挂载 CommandPanel 且不提供 locale
- **THEN** 现有简体中文内建文案和派发行为保持不变
