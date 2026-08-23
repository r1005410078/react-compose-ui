# 物料统一：形状搬进曲线

## Why

**同一条线有两种对象。**工具栏拖一个箭头得到 `shape` 物料——盒加一个
`direction ∈ {-1,0,1}²` 编码方向；命令行敲 `LINE` 得到带 `Curve` 的 Entity——两个真实坐标。
用户看不出为什么，也说不清哪一个才是「线」。决策 8 早就定了：一个形状、一个按钮、一个物料。

**8a 交付之后，搬家的代价塌了一半。**路线图给 8b 列的三样能力里，**椭圆已经不用做**——
非正方盒里的整圆经 `viewBox` 画出来就是椭圆，`projectComposeCurveToBox` 在非等比下拍扁成
多段线，命中也已经跟着变。协议一个字段都不用加。

剩下要补的只有两样，而**两样都是回归防线**而不是新功能：

- **填充**：`shape/circle` 今天靠宿主盒的 `borderRadius: 50%` 把 `Appearance.backgroundPaint`
  裁成椭圆。曲线没有这条，搬过去就丢填充。
- **端点 marker**：`shape/arrow` 的箭头。搬过去就丢箭头。

`shape/` 因此只比 `curve/` 多这两样。补上，它就没有存在的理由了。

## What Changes

- **`materials`**：`curve` 物料承载填充与端点 marker；`shape/` 整个目录删除，
  `arrow` 与 `circle` 两个 Preset 原地换成 `Curve` 实现（**Preset id 与公共导出名不变**）。
- **填充复用 `Appearance.backgroundPaint`**，不新增 props。曲线的填充由 SVG 的 `fill` 画，
  宿主盒 MUST NOT 再画背景——否则用户看到的是一块矩形色块而不是形状内部。v1 只画 `solid`。
- **填充参与命中**：填过色的区域是用户看见的墨，与 CAD 侧「文字按包围盒命中」同一条判断。
  两条命中路径（DOM 与 `entityAtPoint`）都要跟上，`core` 因此新增点在几何内的判定。
- **marker 是几何，跟着 `viewBox` 变形**——与 8a 那句「几何参与变换，描边不参与」一致，
  不为它开例外。
- **绘制提交写真实几何**：`draw-arrow` / `draw-circle` 落地时写 `Curve` 的两个端点或圆心
  半径，`direction` 那套三态编码连同 `directionAxis`、`localLineEndpoint`、
  `shapeDirection` 一起删除。
- **端点选区 UI 删除，不搬**。理由见下。
- **六处 `renderer.type === 'shape'` 特判**（场景层线状判定、圆形 50% 圆角、预览烘焙的
  direction 分支、端点求解、端点提交、工具到 Preset 的映射）全部消失或改按 `Curve` 判定。

## Non-Goals

- **不做顶点编辑。**双击进几何编辑、拖顶点、插入中点顶点是步骤 10。
- **不动 `RECTANGLE` 命令与矩形物料的重叠。**今天 `RECTANGLE` 产出闭合多段线 `Curve`，
  工具栏的矩形产出盒物料——这确实是决策 8 禁止的那种重复，但它**在本刀之前就存在**，
  本刀既不加重也不修它。矩形归属要连着「盒能决定的形状不存几何」一起答，那是独立一刀。
- **不改 Palette 可见性。**`paletteHidden` 的判据是「工具栏是否已提供入口」，与物料统一无关，
  三个 Preset 各自的答案不因换了实现而改变。
- **不加回 `draw-line` 工具。**步骤 6 删掉它的理由（同一个动作两个手感不同的入口）没有变。
- **不做渐变填充。**v1 只画 `solid`；非纯色 Paint 在曲线上不填充。SVG 侧要 `<defs>` 里的
  渐变定义，那是独立一刀。

## 为什么端点选区 UI 是删除而不是搬运

路线图原本写「搬到 `Curve` 是净删代码」。**8a 交付之后这句话不再成立**——不是变难了，
是变得没必要：

一条两点直线的两个端点**就在紧包围盒的对角**。8a 之后拖盒的右下角手柄，几何按比例跟着走，
落点与拖那个端点**逐像素相同**。端点 UI 当初存在，是因为 Shape 的线**没有可用的盒语义**
（盒只能配合 `direction` 表达方向），而现在有了。

留下的差额只有一处：**轴对齐的线**（退化轴钳到 1px）没法靠盒手柄掰成斜的。而这正是步骤 10
的第一个问题——「拖盒手柄与拖顶点各干什么」。现在把一套 Shape 形状的、只认 line/arrow 的
端点 UI 搬进 `Curve`，等于**在步骤 10 必须替换的位置先盖一栋房子**，还会顺手替它回答那个
本该由它决定的问题。

代价是一段可见的空窗：8b 到 10 之间，轴对齐的线要改方向得重画一次。这个代价是明的，
写进路线图，不是被忽略的。

## Impact

- Specs：`basic-materials`（MODIFY 3、ADD 1、REMOVE 1）、`stage`（MODIFY 3、REMOVE 1）、
  `stage-engine`（MODIFY 1、REMOVE 1）、`compose-document`（ADD 1）
- 包：`core`、`materials`、`component-registry`、`stage-engine`、`stage`、`editor`
- 破坏性：`materials` 移除 `createShapeMaterial`、`DEFAULT_COMPOSE_SHAPE_RENDERER`、
  `DEFAULT_COMPOSE_LINE_PRESET` 与 `ComposeShapeMaterialOptions`；`stage-engine` 移除
  `segment.commit` 效果、`segment-endpoint` 命中类型与 `StageSegmentPreview`。
  **不写迁移器**：仓库内零份文档带 `"type": "shape"`，即使有残留也会落到 Registry 既有的
  未知 Renderer 占位上（几何与外观保留，带 `role="status"`）。
