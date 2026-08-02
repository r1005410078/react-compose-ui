## ADDED Requirements

### Requirement: 操作日志右键菜单

操作日志 MUST 为条目和空白区域提供详情、筛选、复制及确认清空菜单。

#### Scenario: 确认清空当前 scope
- **WHEN** 用户确认清空操作日志
- **THEN** 当前 scope 记录被清空且其他 scope 不受影响

#### Scenario: 不显示不存在的日志快捷键
- **WHEN** 用户打开操作日志右键菜单
- **THEN** 菜单不显示快捷键后缀，因为日志操作没有对应的键盘动作
