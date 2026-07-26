## ADDED Requirements

### Requirement: Image 基础物料

materials MUST 注册默认隐藏于 Palette 的 Image definition。Image MUST 使用资源引用、alt 与
object-fit props，以 Blob URL 渲染并在失效或卸载时回收 URL。

#### Scenario: 渲染并更新图片

- **WHEN** Image 节点拥有可解析资源，且 Provider 后续发布内容更新
- **THEN** renderer 使用最新图片并保持节点 props 不变
- **AND** 旧 Blob URL 被回收

### Requirement: 安全可改色 SVG 基础物料

materials MUST 注册默认隐藏于 Palette 的 SVG definition。SVG MUST 在内联前净化可执行内容、
嵌入样式、动画与外部 URL，并支持独立填充和描边覆盖。

#### Scenario: 净化恶意 SVG

- **WHEN** SVG 包含 script、foreignObject、事件属性、动画或外部 href/url
- **THEN** 这些内容不会进入渲染 DOM
- **AND** fragment 引用、几何与安全渐变定义可以保留

#### Scenario: 覆盖填充与描边

- **WHEN** 用户分别启用填充或描边覆盖
- **THEN** 非 none 填充使用目标颜色
- **AND** 只有原本存在且非 none 的描边被替换
