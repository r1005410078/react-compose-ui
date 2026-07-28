## ADDED Requirements

### Requirement: 命令事件右键菜单

CommandPanel MUST 为会话事件提供详情、复制、确认重放和确认清空菜单。

#### Scenario: 确认重放命令
- **WHEN** 用户确认重放一条命令事件
- **THEN** 面板以新 command ID、command-panel-replay 来源且无 mergeKey 派发命令
