## ADDED Requirements

### Requirement: 属性行复用共享右键菜单

Property Panel MUST 使用 `@compose-ui/components` 的 ContextMenu 与 Hook 呈现字段和分组行的右键动作。
三点 overflow 继续是独立的普通点击菜单。

#### Scenario: 右键显示全部属性动作

- **WHEN** 用户右键具有可用或禁用动作的属性字段或分组行
- **THEN** 共享 ContextMenu 显示全部动作并保留禁用状态
- **AND** 点击三点按钮仍只显示空间不足时的 overflow 动作
