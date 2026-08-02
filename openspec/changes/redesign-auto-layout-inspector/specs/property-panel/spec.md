## ADDED Requirements

### Requirement: 无正文属性分组

ComposePropertyPanelSection MUST 支持不可折叠且没有正文的 action-only 模式，用于在稳定分组顺序中
呈现按需添加入口。该模式 MUST 保留标题、搜索语义和右侧操作，但不得渲染空内容区或折叠按钮。

#### Scenario: 显示 action-only 分组

- **WHEN** 宿主声明一个无正文的不可折叠 Section
- **THEN** 面板显示普通一级标题与右侧操作
- **AND** 不显示 chevron、`aria-expanded` 或空正文容器

#### Scenario: 搜索 action-only 分组

- **WHEN** 查询匹配或不匹配 action-only Section 标题
- **THEN** 分组按现有根级搜索规则显示或隐藏
- **AND** 搜索不会创建正文或改变分组状态
