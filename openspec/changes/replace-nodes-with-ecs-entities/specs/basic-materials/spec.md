## MODIFIED Requirements

### Requirement: 基础 Entity Presets

Materials MUST 发布 Container、Rectangle、Text、Image 与 SVG Entity Presets。Container MUST
组合 Transform、Visibility、Lock、Hierarchy、Clip、Appearance；其余 MUST 组合 Transform、
Visibility、Lock、Appearance、Renderer。

#### Scenario: 创建五种 ECS 物料

- **WHEN** Registry 从五种内建 Preset 创建 seed
- **THEN** 每个 seed 是合法独立 ComposeEntity
- **AND** Composition 记录正确 Preset 和基础 Component Keys

### Requirement: 保持基础物料视觉与数据

Rectangle、Text、Image、SVG 的现有 props、资源引用和视觉默认值 MUST 迁移到 Renderer 与
Appearance Components。系统 MUST 删除旧 kind 默认 style 和 Rectangle legacy fallback。

#### Scenario: 渲染 v4 基础物料

- **WHEN** Stage 与 Preview 渲染五种默认 Preset
- **THEN** 尺寸、文字、颜色、图片/SVG 资源和裁剪视觉与迁移前一致

### Requirement: 语义 Component Inspector

Materials Inspector MUST 通过 Registry 的 Component/Renderer 区编辑 Transform、Visibility、
Lock、Appearance 和 Renderer props，并派发 v4 类型化命令。

#### Scenario: 原子更新 Renderer 内容

- **WHEN** 用户修改文字、图片引用或 SVG 样式
- **THEN** 只更新目标 Renderer/Appearance Component
- **AND** 一次 Inspector 提交形成一个事务

### Requirement: 内建能力

Materials MUST 注册“容器”和“几何限制”能力。“容器”默认创建空 Hierarchy 与开启的 Clip；
“几何限制”创建允许全部操作、最小 1×1、无最大尺寸的 TransformConstraints。

#### Scenario: 给 Rectangle 添加容器能力

- **WHEN** 用户向 Rectangle 添加容器能力并放入子项
- **THEN** Rectangle 同时渲染自身和子项
- **AND** 含子项时能力不可移除
