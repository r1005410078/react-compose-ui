## ADDED Requirements

### Requirement: 操作日志右键菜单

操作日志 MUST 为条目和空白区域提供详情、筛选、复制及确认清空菜单。

#### Scenario: 确认清空当前 scope
- **WHEN** 用户确认清空操作日志
- **THEN** 当前 scope 记录被清空且其他 scope 不受影响
