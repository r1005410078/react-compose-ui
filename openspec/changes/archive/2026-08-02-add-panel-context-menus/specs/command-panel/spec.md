## ADDED Requirements

### Requirement: 命令事件右键菜单

CommandPanel MUST 为会话事件提供详情、复制、确认重放和确认清空菜单。

#### Scenario: 确认重放命令
- **WHEN** 用户确认重放一条命令事件
- **THEN** 面板以新 command ID、command-panel-replay 来源且无 mergeKey 派发命令

#### Scenario: 不显示不存在的命令快捷键
- **WHEN** 用户打开命令事件或空白区域右键菜单
- **THEN** 菜单不显示快捷键后缀，因为命令面板没有对应的键盘动作
