# assets Specification

## Purpose
TBD - created by archiving change add-asset-materials-drag. Update Purpose after archive.
## Requirements
### Requirement: 稳定资源引用与解析

系统 MUST 提供 `@compose-ui/assets`，用 providerId、不可变 assetKey 和 persistent/session scope
表达可序列化资源引用，并通过可取消 resolver 读取最新 Blob、mediaType 和 revision。

#### Scenario: 解析稳定引用

- **WHEN** entry 在 Provider 内重命名或移动而树 ID 改变
- **THEN** 原 assetKey 仍解析到最新内容
- **AND** resolver 更新不修改 ComposeDocument 或事务历史

#### Scenario: 缺失或会话引用

- **WHEN** Provider 不匹配、资源不存在，或 session Provider 未重新连接
- **THEN** resolver 返回结构化失败
- **AND** 消费方可以显示可访问缺失资源提示

### Requirement: Provider 引用能力

Provider MUST 仅在 reference capability、entry assetKey 与 resolveAsset 同时存在时允许 Canvas
引用；旧 Provider 未提供这些可选能力时 MUST 保持现有浏览、预览和编辑行为。

#### Scenario: 禁用不可引用资源

- **WHEN** 文件缺少任一引用能力
- **THEN** Asset Browser 不允许把它拖到 Canvas
- **AND** 文件管理操作继续按原 capability 工作
