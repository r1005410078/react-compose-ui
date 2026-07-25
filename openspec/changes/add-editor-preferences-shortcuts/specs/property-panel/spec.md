## ADDED Requirements

### Requirement: 属性面板共享 UI 环境

PropertyPanel MUST 消费共享 Theme/I18n Context，使用语义 token 渲染 Dark/Light，并为搜索、设置、
变量绑定、集合操作、校验状态和可访问名称提供 zh-CN/en-US 内建文案。纯绑定解析 MUST 保留
稳定 issue code，React 展示层 MUST 按 code 本地化；宿主 Schema metadata 保持原文。

#### Scenario: 使用英文浅色属性面板

- **WHEN** PropertyPanel 位于 light/en-US Provider 且包含绑定与集合控件
- **THEN** 第一方 chrome、错误和 ARIA 显示英文并使用完整浅色层级
- **AND** 宿主提供的字段 title、description 与枚举 label 不被翻译

#### Scenario: 覆盖属性面板消息

- **WHEN** 宿主覆盖一个 propertyPanel 命名空间消息
- **THEN** 对应内建文案使用覆盖值
- **AND** 属性 value、Schema 校验与 onValueChange 行为不变
