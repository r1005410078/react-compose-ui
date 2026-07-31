## ADDED Requirements

### Requirement: Property Panel Section 标题栏扩展

ComposePropertyPanelSection MUST 接受可选的标题栏 actions 内容，并在不改变折叠按钮、搜索可见性和
无 actions 分组布局的前提下，将其显示在标题栏右侧。

#### Scenario: 在分组标题栏显示宿主操作

- **WHEN** 宿主为一个 Property Panel Section 提供 actions
- **THEN** actions 显示在同一分组标题栏右侧
- **AND** 操作 actions 不会触发分组折叠
- **AND** 未提供 actions 的既有分组继续使用原有标题栏布局
