## ADDED Requirements

### Requirement: 场景树复用共享右键菜单

场景树 MUST 使用 `@compose-ui/components` 的 ContextMenu 与 Hook 呈现节点和空白区命令菜单，
不得保留独立 Portal 定位、菜单键盘循环或外部点击关闭实现。

#### Scenario: 在共享菜单中保留场景选择语义

- **WHEN** 用户右键已选节点、未选节点或树空白区
- **THEN** 已选节点保留多选，未选节点先请求单选，空白区只显示根级命令
- **AND** Ctrl/Meta 特例仍不打开自定义菜单，命令顺序、禁用状态和危险删除标记保持不变
