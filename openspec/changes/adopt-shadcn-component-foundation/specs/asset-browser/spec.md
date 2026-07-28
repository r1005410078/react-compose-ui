## ADDED Requirements

### Requirement: 资源浏览器复用共享右键菜单

Asset Browser MUST 使用 `@compose-ui/components` 的 ContextMenu 与 Hook 呈现文件树和资源网格的右键
操作，不得保留手写 fixed 菜单与坐标状态。

#### Scenario: 在不同资源视图中打开一致菜单

- **WHEN** 用户在文件树或资源网格右键资源
- **THEN** Browser 先同步该资源选择，再以相同的共享菜单呈现新建、重命名和删除动作
- **AND** Provider capability 禁用、操作完成后的菜单关闭与现有资源操作行为保持不变
