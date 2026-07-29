## MODIFIED Requirements

### Requirement: Appearance 命令的可逆 Paint 更新

Appearance 更新命令 MUST 校验 v5 ComposePaint，并以 Patch 正确保留其它 Appearance 字段。对背景 Paint 的连续预览只允许在 pointer up 提交一个事务；undo/redo 必须完整恢复几何和 stop。

#### Scenario: 提交并撤销渐变手柄变更

- **WHEN** 用户完成一次 Paint 手柄拖动
- **THEN** Runtime 只记录一个可逆 Appearance 事务
- **AND** undo/redo 分别恢复拖动前和拖动后的完整 Paint
