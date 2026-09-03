## MODIFIED Requirements

### Requirement: curve 物料渲染并编辑曲线 Entity

`curve` 物料 MUST 提供 Preset、SVG Renderer 与 Component Definition：Renderer MUST 从
`Curve` Component 读取几何并以 `overflow: visible` 渲染，使几何可以贴着退化盒的边绘制；
Definition 的端点编辑 MUST 派发曲线几何写入漏斗命令，MUST NOT 直接写文档。

描边（颜色、线宽、线型）MUST 作为 Renderer props 承载，复用 Inspector、数据绑定与外观
轨道的既有机制。仓库中 MUST NOT 再存在第二个绘制线条的物料——「盒 + 方向」与「坐标」是同一件
事的两种表示，留下的是坐标那一种。

Renderer MUST 按 `kind` 分派 SVG 元素：`line` 与 `polyline` 各用**一个**元素（闭合多段线用
`polygon`），弧用 `path`，**整圆用 `circle`**——SVG 的 `A` 命令在起终点重合时画不出东西。
`path` MUST 用**一个** `<path>`：全部子路径写进同一个 `d`，闭合的子路径以 `Z` 收尾。
拆成多个元素会让填充规则失效——洞与实心的区别正是同一个 `d` 内多条子路径共同决定的。
`path` 的 `fill-rule` 属性 MUST 由 `Curve.fillRule` 推出，缺席时 MUST NOT 写出该属性。

未填充时命中 MUST 继续由透明加宽 stroke 承担，MUST NOT 因 `kind` 变化而改用盒判定。

命中层的宽度 MUST 由 `COMPOSE_CURVE_PICK_TOLERANCE` 推出（两倍容差，与视觉线宽取较大者），
MUST NOT 在本包另写一个数——它同时是 Stage 拾取框的来源，各写一份必然漂移。命中层的
`stroke-linecap` MUST 为 `butt`，MUST NOT 为 `round`：后者让命中区从两端各伸出半个带宽，
成为包围盒的超集。这一条只作用于两个自由端，多段线拐角仍由 `stroke-linejoin` 覆盖。

Inspector MUST 按 `kind` 呈现对应的几何字段，全部写入 MUST 走同一条漏斗命令。
`path` MUST NOT 呈现逐控制点的几何字段：一条导入来的路径有几十个控制点，逐点列出的面板既读
不懂也点不动，而它的几何编辑入口在画布上（顶点方块与控制手柄）。描边、填充与变换字段照常呈现。

#### Scenario: 渲染跟随几何

- **WHEN** 通过漏斗命令修改线的端点
- **THEN** 画布与预览中的线立即按新几何渲染

#### Scenario: Inspector 编辑端点

- **WHEN** 在属性面板修改端点坐标
- **THEN** 派发漏斗命令，撤销一步回到原几何

#### Scenario: 描边经由 Renderer props

- **WHEN** 在属性面板修改描边颜色或线宽
- **THEN** 变更写入 Renderer props 并即时渲染，可参与数据绑定

#### Scenario: 带洞的路径渲染成一个元素

- **WHEN** 渲染一条含两条子路径、`fillRule` 为 `evenodd` 的 `path`
- **THEN** 页面里是**一个** `<path>`，`fill-rule` 为 `evenodd`，洞是透的

#### Scenario: 缺席的 fillRule 不写属性

- **WHEN** 渲染一条 `fillRule` 缺席的 `path`
- **THEN** 元素上没有 `fill-rule` 属性

#### Scenario: path 的 Inspector 不列控制点

- **WHEN** 选中一条 `path` 曲线
- **THEN** 属性面板呈现描边与填充分组，不呈现任何逐点几何字段
