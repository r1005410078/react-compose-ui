# 曲线词汇：弧与多段线

## Why

绘图模式现在只画得出**直线**。主接线图上每一个符号——刀闸的转轴、断路器的圆、互感器的圈、
母线的折角——都要弧或多段线。词汇不齐，绘图模式就只能画方框图。

`kind` union 从第一天就是为这一步留的（`ComposeCurveKind` 的 TSDoc 写着「保留为联合类型而不是
字面量，使新增弧、多段线时既有文档不需要迁移」）。这一刀把那句话兑现。

数学不用发明：`cad/geometry` 里的弧与多段线运算是纯形状函数，不认识任何文档协议，搬过来即可。

## What Changes

- **`core`**：`ComposeCurve` 扩成三元联合——`line` / `arc` / `polyline`。
  归一化、紧包围盒、平移、点到几何距离、字段校验各自逐 kind 分派。
  **整圆是扫掠 ±360 的弧、矩形是闭合多段线**，不另立类型——两条判断从 `cad` 原样平移。
- **`stage-engine`**：特征点捕捉按 kind 扩展（弧补**圆心与象限点**，多段线的顶点即各段端点）；
  窄相位命中改由 `distanceToComposeCurve` 逐 kind 分派，**调用点一行不改**。
- **`materials`**：`curve` Renderer 逐 kind 出 SVG——弧走 `<path>` 的 `A`、**整圆走
  `<circle>`**（`A` 在起终点重合时画不出东西）、多段线走**一个** `<polyline>` / `<polygon>`。
  Inspector 的端点字段逐 kind 呈现。
- **`stage-engine`**：新增 `ARC`（三点）、`CIRCLE`、`REC`（两角）、`PLINE`（连续顶点）四条绘图命令。
- **`cad`**：几何函数下沉到 `core` 后，`cad` 侧改为别名转导（与步骤 2 搬点输入管线同一做法），
  既有 87 项 CAD 用例不改一行即全绿是搬运没有改变行为的证据。

**不做**（各有理由，见 design）：`bulge`（多段线里的弧段）、椭圆、样条、顶点夹点编辑、
`ARC` 的其它起算方式（起点/圆心/角度等 AutoCAD 的十一种）。

## Impact

- Affected specs: `compose-document`、`stage-engine`、`basic-materials`
- Affected code: `packages/core/src/curve.ts`、`packages/core/src/builtin-commands.ts`、
  `packages/stage-engine/src/hit-testing/feature-points.ts`、`packages/stage-engine/src/drafting/`、
  `packages/materials/src/curve/`、`packages/cad/src/geometry/`
- 协议版本不变；`kind` 是新增分支，既有 `line` 文档一行不动，**无迁移**。
