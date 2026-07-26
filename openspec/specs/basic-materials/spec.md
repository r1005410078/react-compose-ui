# basic-materials Specification

## Purpose
TBD - created by archiving change add-basic-materials. Update Purpose after archive.
## Requirements
### Requirement: 独立基础物料包

materials MUST 提供默认启用 clipContent 的 Frame preset、Rectangle/Text definitions 与只接受
ComposeFrameNode 的 ContainerInspector。BasicMaterialFrameOptions MUST 允许覆盖默认裁剪值。

#### Scenario: 创建统一 Frame 物料

- **WHEN** 宿主创建默认或覆盖后的 basic materials
- **THEN** Frame preset 返回独立 style、尺寸和 defaultClipContent
- **AND** 包不导入或引用 ComposeGroupNode

### Requirement: 完整基础物料与 Inspector

Frame Inspector MUST 编辑名称、位置、尺寸、rotation、clipContent 和通用 style；Rectangle/Text
Inspector 行为保持。跨 transform/style/clipContent 修改 MUST 使用一个原子 batch。

#### Scenario: 编辑 Frame 裁剪和旋转

- **WHEN** 用户同时修改 Frame rotation 与 clipContent
- **THEN** 文档通过一个事务更新两个字段
- **AND** undo/redo 恢复完整状态

### Requirement: 基础材料 Inspector 共享 UI 环境

Frame、Group、Rectangle 与 Text 的第一方 Inspector MUST 消费共享 Theme/I18n Context，并为内建
字段、分组、帮助文案和操作提供 zh-CN/en-US 文案与语义主题 token。宿主扩展 definition、
registry label、自定义 Inspector 和自定义 Schema metadata MUST 保持原文。

#### Scenario: 使用英文基础材料 Inspector

- **WHEN** 基础材料 Inspector 位于 en-US Provider
- **THEN** 第一方字段和操作显示英文
- **AND** 宿主扩展物料的标签和业务字段保持宿主提供的内容

#### Scenario: 切换 Inspector 主题

- **WHEN** Provider 从 dark 切换为 light
- **THEN** Inspector surface、输入、边框、文本和焦点态使用浅色 token
- **AND** Inspector 不重新创建 registry 或修改节点文档

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
