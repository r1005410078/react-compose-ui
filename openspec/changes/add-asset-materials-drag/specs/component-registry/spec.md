## ADDED Requirements

### Requirement: Definition 资源创建协议

ComponentDefinition MAY 隐藏 Palette 项并声明资源 MIME 匹配和异步 seed factory。Registry MUST
按定义顺序选择首个匹配项，并把 unsupported 与 factory failure 作为结构化结果返回。

#### Scenario: 从图片资源创建 seed

- **WHEN** Registry 收到可解析的受支持图片
- **THEN** 首个匹配 definition 返回包含资源 props、名称与尺寸的独立 seed
- **AND** Palette hidden definition 仍可由 Stage 和 Preview 渲染

#### Scenario: 资源 factory 失败

- **WHEN** 没有 definition 匹配或 factory 抛错
- **THEN** Registry 返回稳定错误且不创建部分 seed

### Requirement: Renderer 资源解析上下文

RegistryComponent MUST 把可选 assetResolver 传给 definition renderer；省略 resolver 时原有
definition 行为 MUST 保持不变。

#### Scenario: 独立组件无 Resolver

- **WHEN** 非资源 definition 或旧宿主未提供 assetResolver
- **THEN** renderer 继续正常渲染
