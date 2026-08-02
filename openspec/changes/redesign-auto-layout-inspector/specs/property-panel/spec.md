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

### Requirement: 多嵌入 Inspector 的 Section 可见性

ComposePropertyPanelSection MUST 独立收集每个嵌入 ComposePropertyPanel 的搜索可见性，并在任一子面板
匹配时保持 Section 可见。子面板卸载 MUST 清理其注册，不能让后一次报告覆盖其他子面板状态。

#### Scenario: 搜索合并后的基础分组

- **WHEN** 同一 Section 内的 Identity 与复合几何 Inspector 中任一字段匹配查询
- **THEN** Section 显示并在搜索期间展开，且只渲染匹配字段
- **AND** 其他嵌入 Inspector 的不匹配结果不会隐藏整个 Section

#### Scenario: 清理嵌入 Inspector 可见性

- **WHEN** 一个嵌入 Inspector 因 Entity 或 Component 切换而卸载
- **THEN** Section 删除对应可见性记录
- **AND** 后续搜索只由仍挂载的 Inspector 决定
