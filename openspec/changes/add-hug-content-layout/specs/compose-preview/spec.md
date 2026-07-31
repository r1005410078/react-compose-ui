## MODIFIED Requirements

### Requirement: 独立只读 Preview

ComposePreview MUST 创建或接受 Layout Runtime，并把 Registry measurement adapter 接入该 Runtime。
Hug 内容完成异步准备后 MUST 使用新 Snapshot 重渲染；loading/error/fallback 状态 MUST 可访问且不依赖
Editor 或 Stage。

#### Scenario: Preview 独立解析 Hug
- **WHEN** 独立 Preview 渲染包含 Text、Image、SVG 或 Page Slot Hug 的 v6 文档
- **THEN** 它使用与 Stage 相同 measurement definition 和 Layout 语义得到 local boxes
- **AND** 卸载会取消全部 prepare、订阅、离屏 host 与 Layout Runtime

