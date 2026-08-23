# basic-materials 规范增量

## MODIFIED Requirements

### Requirement: 基础 Entity Presets

Materials MUST 发布 Container、Rectangle、Text、Image、SVG、Curve、Arrow 与 Circle
Entity Presets。Container MUST 组合 Transform、Visibility、Lock、Hierarchy、Clip、Appearance；
Rectangle、Text、Image 与 SVG Presets MUST 组合 Transform、Visibility、Lock、Appearance、Renderer。

Curve、Arrow 与 Circle MUST 是**同一个 `curve` 物料的三个起点**：三者 MUST 在上述 Component
之外组合 `Curve`，差别只在默认几何与默认描边（Arrow 默认终点 marker 为箭头，Circle 默认几何
是扫掠 360 的弧）。MUST NOT 为它们注册第二个 Renderer 类型——「盒 + 方向」与「坐标」不得同时
存在两种线的表示，用户看不出区别却会得到不同的编辑手感。

已经拥有专用创建入口的 Preset MUST 默认隐藏于 Palette，避免同一个创建动作出现两个入口：
Text、Arrow 与 Circle 由 Stage 工具栏绘制工具提供入口。默认隐藏 MUST 只影响 Palette
呈现，MUST NOT 影响 Registry 注册、拖入、键盘新增、资源拖放或文档反序列化；宿主 MUST
能够通过物料 options 覆盖该默认。

#### Scenario: 创建基础 ECS 物料

- **WHEN** Registry 从所有内建 Preset 创建 seed
- **THEN** 每个 seed 是合法独立 ComposeEntity
- **AND** Composition 记录正确 Preset 与基础 Component Keys

#### Scenario: 三个曲线起点共用一个 Renderer

- **WHEN** Registry 从 Curve、Arrow 与 Circle Preset 各创建一个 seed
- **THEN** 三者的 Renderer 类型相同，且都带 `Curve` Component
- **AND** Registry 中不存在第二个绘制线条的 Renderer 类型

#### Scenario: 默认 Palette 不重复工具栏入口

- **WHEN** 宿主使用默认基础物料渲染组件库 Palette
- **THEN** Text、Arrow 与 Circle 不出现在 Palette 中
- **AND** 这些 Preset 仍可由工具栏、资源拖入与 Registry API 正常创建

#### Scenario: 形状跨入口一致渲染

- **WHEN** Stage 或 Preview 渲染 Arrow 或 Circle Entity
- **THEN** 两个入口基于同一 `Curve` 几何输出相同形状与方向
- **AND** 反向拖拽不产生负 LayoutItem 尺寸

### Requirement: curve 物料渲染并编辑曲线 Entity

`curve` 物料 MUST 提供 Preset、SVG Renderer 与 Component Definition：Renderer MUST 从
`Curve` Component 读取几何并以 `overflow: visible` 渲染，使几何可以贴着退化盒的边绘制；
Definition 的端点编辑 MUST 派发曲线几何写入漏斗命令，MUST NOT 直接写文档。

描边（颜色、线宽、线型）MUST 作为 Renderer props 承载，复用 Inspector、数据绑定与外观
轨道的既有机制。仓库中 MUST NOT 再存在第二个绘制线条的物料——「盒 + 方向」与「坐标」是同一件
事的两种表示，留下的是坐标那一种。

Renderer MUST 按 `kind` 分派 SVG 元素：`line` 与 `polyline` 各用**一个**元素（闭合多段线用
`polygon`），弧用 `path`，**整圆用 `circle`**——SVG 的 `A` 命令在起终点重合时画不出东西。
未填充时命中 MUST 继续由透明加宽 stroke 承担，MUST NOT 因 `kind` 变化而改用盒判定。

Inspector MUST 按 `kind` 呈现对应的几何字段，全部写入 MUST 走同一条漏斗命令。

#### Scenario: 渲染跟随几何

- **WHEN** 通过漏斗命令修改线的端点
- **THEN** 画布与预览中的线立即按新几何渲染

#### Scenario: Inspector 编辑端点

- **WHEN** 在属性面板修改端点坐标
- **THEN** 派发漏斗命令，撤销一步回到原几何

#### Scenario: 描边经由 Renderer props

- **WHEN** 在属性面板修改描边颜色或线宽
- **THEN** 变更写入 Renderer props 并即时渲染，可参与数据绑定

#### Scenario: 整圆用 circle 渲染

- **WHEN** 渲染一个扫掠为 360 的弧
- **THEN** 使用 `circle` 元素而不是起终点重合的 `path`

#### Scenario: 多段线是一个元素

- **WHEN** 渲染一条含四个顶点的多段线
- **THEN** 图面上只有一个多段线元素，而不是三个线段元素

#### Scenario: 空角仍不命中

- **WHEN** 点击一段未填充的弧包围盒内远离弧身的位置
- **THEN** 该弧不被选中

### Requirement: 形状类 Material 不得覆盖 Appearance 填色

形状类基础物料（至少包含 Rectangle）的 Renderer 根节点 MUST NOT 使用不透明 CSS 默认背景覆盖 Entity Appearance。填色、圆角与阴影 MUST 由共享 Appearance / Paint 层表达；Material 仅承担内容占位或非填色职责。默认视觉值 MUST 写在 Preset/seed 的 Appearance 上，不得依赖 Material 样式表中的第二套默认色。

**带 `Curve` 的 Entity 是本条唯一的例外**：它的填色由 Material 自己的 SVG `fill` 绘制，
宿主盒与共享 Paint 层 MUST NOT 为它绘制任何背景。盒是矩形而形状不是，让共享层画等于把
一块矩形色块摆在形状后面。判据 MUST 是 `Curve` Component 而不是 Renderer 类型。

#### Scenario: Rectangle 改色不被 Material CSS 盖住

- **WHEN** Rectangle Entity 的 Appearance.backgroundPaint 为非默认 solid 色且 borderRadius 非 0
- **AND** Stage、Preview 或 component-instance 嵌套路径渲染该 Entity
- **THEN** 可见填色与 computed 背景反映 Appearance 色值
- **AND** Material 根节点不绘制与 Appearance 冲突的默认蓝底

#### Scenario: Rectangle 默认外观来自 seed Appearance

- **WHEN** Registry 从默认 rectangle Preset 创建 seed
- **THEN** Appearance 含明确的默认 solid 填色与 borderRadius

#### Scenario: 曲线的填色不落在宿主盒上

- **WHEN** 一个闭合曲线 Entity 的 Appearance.backgroundPaint 为不透明 solid 色
- **THEN** 宿主盒的 computed 背景是透明的
- **AND** 可见色块的轮廓是该几何而不是矩形

## ADDED Requirements

### Requirement: 曲线承载填充与端点 marker

`curve` 物料 MUST 支持填充与端点 marker，两者合起来是 `shape` 物料相对它仅有的差额。

**填充 MUST 复用 `Appearance.backgroundPaint`**，MUST NOT 新增 Renderer prop：填充要参与
命中，而命中路径读的字段 MUST 是文档级契约。复用还让外观 Inspector、数据绑定与外观动画
轨道一样都不用做。v1 MUST 只绘制 `solid`；非纯色 Paint 在曲线上不填充。

填充 MUST 按 SVG 自身的规则作用于几何，MUST NOT 前置判断 `closed`：开放几何按隐式闭合填充，
渲染与命中因此自动一致。

**端点 marker MUST 作为 Renderer props 承载**（`markerStart` / `markerEnd`，取值至少含
`none` 与 `arrow`）：只有渲染与 Inspector 读它。默认无 marker，Arrow Preset 默认终点为箭头。

marker MUST 参与 `viewBox` 变换——它是画在端点上的一小片形状，属于「几何参与变换，描边不
参与」里的几何那一半。MUST NOT 为它开例外：整个图形被非等比盒拉扁时，箭头不跟着扁才是错的。

#### Scenario: 填充跟随形状而不是盒

- **WHEN** 把一个整圆曲线的 Appearance 背景设成不透明纯色
- **THEN** SVG 的几何元素以该颜色填充
- **AND** 宿主盒不绘制背景

#### Scenario: 默认曲线不填充

- **WHEN** 从默认 Curve Preset 创建 Entity 并渲染
- **THEN** 几何不被填充，渲染结果与本能力之前逐像素相同

#### Scenario: 箭头附着在终点

- **WHEN** 渲染一个 `markerEnd` 为箭头的两点直线
- **THEN** 箭头画在几何的终点上并朝向线的方向

#### Scenario: 箭头跟随非等比盒变形

- **WHEN** 把带箭头的直线的盒拉成宽扁形状
- **THEN** 箭头按与线相同的比例变形

## REMOVED Requirements

### Requirement: Line 与 Arrow 的常用描边属性

**Reason**: `shape` 物料删除，Line 与 Arrow 的描边由 `curve` 物料的 Renderer props 承载；
`direction` 的零轴表达随两点方向编码一起消失，方向由两个真实端点坐标表达。

**Migration**: 无。仓库中零份文档带 `"type": "shape"`；即使有残留，Registry 既有的未知
Renderer 占位会保留几何与外观并带 `role="status"`。
