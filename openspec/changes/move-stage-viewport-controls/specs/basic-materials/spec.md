## MODIFIED Requirements

### Requirement: 基础 Entity Presets

Materials MUST 发布 Container、Rectangle、Text、Image、SVG、Line、Arrow 与 Circle Entity Presets。Container
MUST 组合 Transform、Visibility、Lock、Hierarchy、Clip、Appearance；Rectangle、Text、Image、SVG 与形状
Renderer Presets MUST 组合 Transform、Visibility、Lock、Appearance、Renderer。Line、Arrow 与 Circle MUST 使用
第一方结构化 Shape Renderer props，不得依赖外部 SVG asset 或 Stage 专属数据。

#### Scenario: 创建基础与形状 ECS 物料

- **WHEN** Registry 从所有内建 Preset 创建 seed
- **THEN** 每个 seed 是合法独立 ComposeEntity
- **AND** Composition 记录正确 Preset、基础 Component Keys 与 Shape Renderer 类型

#### Scenario: 形状跨入口一致渲染

- **WHEN** Stage 或 Preview 渲染 Line、Arrow 或 Circle Entity
- **THEN** 两个入口基于同一 Renderer props 输出相同形状与方向
- **AND** 反向拖拽不产生负 LayoutItem 尺寸

## ADDED Requirements

### Requirement: Line 与 Arrow 的常用描边属性

Line 与 Arrow MUST 在其结构化 Shape Renderer props 中持久化 `stroke`、`strokeWidth`、
`strokeLinecap`、`strokeDasharray`、`markerStart` 与 `markerEnd`。Inspector MUST 提供颜色、粗细、
平头/圆头/方头、实线/虚线/点线以及起点/终点箭头；不为单根直线提供 fill、line join、marker mid 或
dash offset。Line 默认没有 marker，Arrow 默认终点 marker 为箭头；缺少新 props 的旧 Arrow 仍必须显示终点箭头。

#### Scenario: 编辑线条外观

- **WHEN** 用户在 Inspector 编辑 Line 或 Arrow 的线条属性
- **THEN** Stage 与 Preview 使用同一 Shape Renderer 立即显示对应描边、端点和箭头
- **AND** Renderer props 之外的 authored fields 保持不变

#### Scenario: 水平或垂直线

- **WHEN** 用户绘制或编辑水平、垂直的 Line 或 Arrow
- **THEN** `direction` 可以使用零轴表达重合坐标
- **AND** 为 LayoutItem 保留的最小 1px 尺寸不产生可见的斜线偏移
