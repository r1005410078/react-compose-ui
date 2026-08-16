## ADDED Requirements

### Requirement: 可配置层级动作

Editor Preferences MUST 增加前移、后移、置顶和置底四个 Stage scope 动作，并将它们装配到共享执行层、
设置与命令面板。旧偏好缺少新动作时 MUST 补齐默认键位，不得导致 Stage 运行失败。

#### Scenario: 规范化旧快捷键偏好

- **WHEN** 宿主提供不含四个层级动作的旧 shortcuts 对象
- **THEN** normalize 为新动作补齐 Figma 风格默认键位
- **AND** 全部既有自定义键位保持不变

#### Scenario: 命令面板执行层级动作

- **WHEN** 用户从命令面板执行一个可用层级动作
- **THEN** 动作通过事务运行时提交与 Stage 快捷键相同的顺序结果
- **AND** 不可用时显示双语边界原因且不产生事务
