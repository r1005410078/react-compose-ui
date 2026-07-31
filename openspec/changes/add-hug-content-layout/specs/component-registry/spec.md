## MODIFIED Requirements

### Requirement: Renderer 与 Component Inspector

Registry MUST 允许 Renderer Definition 提供无 Scene DOM 依赖的 measurement definition，包含同步
measure、可选异步 prepare 与 baseline。Registry MUST 保持 definition 实例隔离，并且消费方 MUST 把 invalid/throwing measurement 隔离为
可恢复失败而不是破坏 Renderer 渲染。

#### Scenario: 自定义 Renderer 提供 Hug 测量
- **WHEN** 宿主 Renderer 注册 measurement 并在 Exactly、AtMost、Undefined 约束下返回尺寸
- **THEN** Registry measurement adapter 向 Layout Runtime 提供同步缓存结果与可选 baseline
- **AND** prepare 被取消、迟到或抛错时只返回 fallback 状态并允许后续 revision 恢复

## ADDED Requirements

### Requirement: 可释放的 Registry Measurement Adapter

系统 MUST 提供把 registry、asset resolver、page loader 与 browser measurement environment 组合为
core measurement port 的 adapter。Adapter MUST 缓存、订阅、取消、丢弃迟到结果并在 dispose 后停止通知。

#### Scenario: 资源 revision 使测量失效
- **WHEN** Image、SVG 或 Page Renderer 的稳定引用发布新资源/page revision
- **THEN** adapter 重新 prepare 对应 Entity 并发布精确 invalidation
- **AND** 旧 Promise 结果、旧 Blob 和已取消订阅不能覆盖新缓存
