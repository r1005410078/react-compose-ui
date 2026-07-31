## MODIFIED Requirements

### Requirement: 内建 Text 物料

Text Renderer MUST 提供与其可见样式一致的 Hug measurement，支持 Explicit/AtMost/Undefined 约束、
换行、font readiness 与 baseline，且 MUST 使用隔离测量 host 而不是 Scene Entity DOM。

#### Scenario: 字体完成后更新 Text Hug
- **WHEN** Text 首次用 fallback 字体测量后目标字体完成加载
- **THEN** measurement revision 使 Text 与其 Auto Layout 祖先重新布局
- **AND** 不产生文档事务或读取 Stage/Preview Entity DOM

### Requirement: Image、SVG 与 Page Slot 物料

Image、SVG 与 Page Slot MUST 分别使用 resolved asset natural size、SVG intrinsic box 与目标页面 output
size 作为 Hug measurement，并在各自 subscription revision 变化时失效。

#### Scenario: 异步资源驱动 Hug
- **WHEN** Hug Image、SVG 或 Page Slot 的资源从 loading 变为 ready 或发布新 revision
- **THEN** 首帧使用 LayoutItem fallback，ready 后使用新的 intrinsic size 重排
- **AND** 失败状态保持 fallback 与可访问占位，不修改文档

