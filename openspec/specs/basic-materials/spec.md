# basic-materials Specification

## Purpose
TBD - created by archiving change add-basic-materials. Update Purpose after archive.
## Requirements
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

materials MUST 发布默认隐藏于 Palette 的 Image Entity Preset。Image MUST 使用资源引用、alt 与
object-fit Renderer props，以 Blob URL 渲染并在失效或卸载时回收 URL。

#### Scenario: 渲染并更新图片

- **WHEN** Image Entity 拥有可解析资源，且 Provider 后续发布内容更新
- **THEN** renderer 使用最新图片并保持 Renderer props 不变
- **AND** 旧 Blob URL 被回收

### Requirement: 安全可改色 SVG 基础物料

materials MUST 发布默认隐藏于 Palette 的 SVG Entity Preset。SVG MUST 在内联前净化可执行内容、
嵌入样式、动画与外部 URL，并支持独立填充和描边覆盖。

#### Scenario: 净化恶意 SVG

- **WHEN** SVG 包含 script、foreignObject、事件属性、动画或外部 href/url
- **THEN** 这些内容不会进入渲染 DOM
- **AND** fragment 引用、几何与安全渐变定义可以保留

#### Scenario: 覆盖填充与描边

- **WHEN** 用户分别启用填充或描边覆盖
- **THEN** 非 none 填充使用目标颜色
- **AND** 只有原本存在且非 none 的描边被替换

### Requirement: 基础 Entity Presets

Materials MUST 发布 Container、Rectangle、Text、Image 与 SVG Entity Presets。Container MUST
组合 Transform、Visibility、Lock、Hierarchy、Clip、Appearance；其余 MUST 组合 Transform、
Visibility、Lock、Appearance、Renderer。

#### Scenario: 创建五种 ECS 物料

- **WHEN** Registry 从五种内建 Preset 创建 seed
- **THEN** 每个 seed 是合法独立 ComposeEntity
- **AND** Composition 记录正确 Preset 和基础 Component Keys

### Requirement: 语义 Component Inspector

Materials Inspector MUST 通过 Registry 的 Component/Renderer 区编辑 Transform、Visibility、
Lock、Appearance 和 Renderer props，并派发 v4 类型化命令。

#### Scenario: 原子更新 Renderer 内容

- **WHEN** 用户修改文字、图片引用或 SVG 样式
- **THEN** 只更新目标 Renderer/Appearance Component
- **AND** 一次 Inspector 提交形成一个事务

### Requirement: 保持基础物料视觉与数据

Rectangle、Text、Image、SVG 的现有 props、资源引用和视觉默认值 MUST 迁移到 Renderer 与
Appearance Components。系统 MUST 删除旧 kind 默认 style 和 Rectangle legacy fallback。

#### Scenario: 渲染 v4 基础物料

- **WHEN** Stage 与 Preview 渲染五种默认 Preset
- **THEN** 尺寸、文字、颜色、图片/SVG 资源和裁剪视觉与迁移前一致

### Requirement: 内建能力

Materials MUST 注册“容器”和“几何限制”能力。“容器”默认创建空 Hierarchy 与开启的 Clip；
“几何限制”创建允许全部操作、最小 1×1、无最大尺寸的 TransformConstraints。

#### Scenario: 给 Rectangle 添加容器能力

- **WHEN** 用户向 Rectangle 添加容器能力并放入子项
- **THEN** Rectangle 同时渲染自身和子项
- **AND** 含子项时能力不可移除

### Requirement: 内建 Component 定义自带 Inspector

createComposeBuiltinComponentDefinitions MUST 为 Transform、Visibility、Lock、Appearance、
Hierarchy 与 TransformConstraints 提供符合 Registry Inspector 协议的编辑 UI；Lock Inspector
MUST 在 readOnly 上下文中仍可解除锁定；Clip 的开关由 Hierarchy Inspector 呈现。

#### Scenario: Registry 协议驱动内建分组

- **WHEN** 宿主使用 createComposeBasicMaterials 构建 Registry
- **THEN** 编辑器无需硬编码即可按定义顺序渲染全部内建 Component 分组

### Requirement: Renderer Inspector 保留 schema 之外的 props

内容 Inspector 提交 setRendererProps 时 MUST 合并当前 Renderer props，
不得丢弃 schema 未覆盖的宿主字段。

#### Scenario: 编辑 Text 内容保留宿主扩展字段

- **WHEN** Text Renderer props 含 schema 之外的宿主字段且用户修改文本
- **THEN** 派发的 props 同时包含新文本与原有宿主字段

