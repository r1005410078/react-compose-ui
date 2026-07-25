## ADDED Requirements

### Requirement: 操作日志面板共享 UI 环境

OperationLog 默认 React 面板 MUST 消费共享 Theme/I18n Context，使用语义 token 渲染 Dark/Light，
并为搜索、筛选、空态、结构化详情、快照状态和可访问名称提供 zh-CN/en-US 内建文案。日志协议、
持久化内容、宿主 action/summary 和 snapshot 数据 MUST 保持原样。

#### Scenario: 使用中文浅色操作日志

- **WHEN** OperationLog 面板位于 light/zh-CN Provider
- **THEN** 第一方 chrome 与可访问名称显示中文并使用完整浅色层级
- **AND** 已记录的宿主摘要、目标名称和快照内容不被翻译

#### Scenario: 覆盖操作日志消息

- **WHEN** 宿主覆盖一个 operationLog 命名空间消息
- **THEN** 对应面板 chrome 使用覆盖值
- **AND** controller 查询、选择和持久化行为不变
