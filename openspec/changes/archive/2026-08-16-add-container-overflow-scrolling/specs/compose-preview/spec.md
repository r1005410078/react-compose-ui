## ADDED Requirements

### Requirement: Preview 原生 Container 滚动

Preview MUST 在真实递归 DOM 层级上把规范化分轴策略映射为原生 overflow，并让滚动位置保持为
非持久化的浏览器会话状态。

#### Scenario: 纵向内容真实滚动

- **WHEN** 容器纵向配置为 `scroll` 且子内容超过容器高度
- **THEN** Preview 出现原生纵向滚动范围并允许用户滚动，而文档保持不变

#### Scenario: 滚动范围保留末端内边距

- **WHEN** Auto Layout 容器带有底部或右侧内边距且内容溢出
- **THEN** Preview 的原生滚动范围在最后一个子项之后保留对应末端内边距
