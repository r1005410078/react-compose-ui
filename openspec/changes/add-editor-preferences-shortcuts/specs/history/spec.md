## ADDED Requirements

### Requirement: 历史面板内建本地化

HistoryPanel MUST 接受可选 zh-CN 或 en-US locale，并在未提供时保持 zh-CN。标题、当前/未来状态、
空状态和可访问名称 MUST 使用内建词典；宿主提供的历史 label MUST 保持原文。

#### Scenario: 使用英文历史面板

- **WHEN** 宿主以 en-US 挂载 HistoryPanel
- **THEN** 面板 chrome、状态和可访问名称显示英文
- **AND** 各历史条目的宿主 label 不被翻译

#### Scenario: 独立使用默认语言

- **WHEN** 宿主独立挂载 HistoryPanel 且不提供 locale
- **THEN** 现有简体中文内建文案和导航行为保持不变
