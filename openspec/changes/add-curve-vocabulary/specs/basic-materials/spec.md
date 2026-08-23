## MODIFIED Requirements

### Requirement: curve 物料渲染并编辑曲线 Entity

`curve` 物料 MUST 提供 Preset、SVG Renderer 与 Component Definition：Renderer MUST 从
`Curve` Component 读取几何并以 `overflow: visible` 渲染，使几何可以贴着退化盒的边绘制；
Definition 的端点编辑 MUST 派发曲线几何写入漏斗命令，MUST NOT 直接写文档。

描边（颜色、线宽、线型）MUST 作为 Renderer props 承载，复用 Inspector、数据绑定与外观
轨道的既有机制。既有 `shape` 物料 MUST 保持不变——「盒 + 方向」与「坐标」是两种语义。

Renderer MUST 按 `kind` 分派 SVG 元素：`line` 与 `polyline` 各用**一个**元素（闭合多段线用
`polygon`），弧用 `path`，**整圆用 `circle`**——SVG 的 `A` 命令在起终点重合时画不出东西。
命中 MUST 继续由透明加宽 stroke 承担，MUST NOT 因 `kind` 变化而改用盒判定。

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

- **WHEN** 点击一段弧包围盒内远离弧身的位置
- **THEN** 该弧不被选中
