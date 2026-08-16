## ADDED Requirements

### Requirement: 框选工具快捷键

Editor Preferences MUST 提供可配置的 `stage.marqueeTool` 动作，默认键位 `B`，并 MUST 与其他
Stage 工具动作一样归入 stage 分类、出现在快捷键设置与命令面板中。该动作 MUST 只切换工具，
不改变当前框选判定模式，并 MUST 遵守既有的快捷键输入隔离规则。

#### Scenario: 使用默认键位切换框选工具

- **WHEN** 焦点不在文本输入且用户按下 `B`
- **THEN** Stage 工具切换为 marquee
- **AND** 当前框选判定模式保持不变

#### Scenario: 重新绑定框选工具键位

- **WHEN** 用户在快捷键设置中为 `stage.marqueeTool` 捕获新键位
- **THEN** 新键位生效并随 preferences 一起持久化
