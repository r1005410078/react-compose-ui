# 变更：布尔运算接受由圆弧围成的路径——产品自己填出来的每一块面都能再算

## 原因

两个圆重叠，用油漆桶把三块面各填一次，然后框选全部点并集——四种区域运算一个都不做，命令行
左下角写着「这一版还不支持『Hatch』这样带曲线段的路径参与布尔运算」。用户读到的是「没有效果」。

这是两条各自成立的既有决定撞在一起：

- 填充求面产出的面**边上有弧就只能落成 `path`**——多段线的顶点没有 bulge，弧边没有别的地方
  可放（`composeCurveFromOutline`：单环全直边落 `polyline`，否则 `path`）。
- 布尔运算的提案把 `path` 操作数整个划进 v1 不做：「`ComposeOutlinePiece` 只有 segment 与 arc，
  求交只有线×线、线×弧、弧×弧三支」。理由是平面图的边还没有三次贝塞尔这一种。

于是只选两个圆能算（圆是弧），一旦框选带上任何一块由圆围出来的填充，整批被拒——拒绝的判据
是「有一个操作数不合格就全部不算」。产品自己产出的东西，产品自己不认，这不是 v1 边界，是缺口。

关键的既有事实：**那些贝塞尔本来就是弧**。填充求面与布尔运算落 `path` 时走的都是
`composeArcToCubicShapes`——每段至多 90°、控制点沿两端切线各伸出 `(4/3)·tan(Δ/4)·r` 的经典
闭式解，而这个闭式解**把曲线中点钉在圆上**。反过来识别是精确的：过起点、中点、终点三点定圆，
按闭式解预测两个控制点，对上了就是弧。

## 变更内容

- **`core` 新增「三次贝塞尔识别回圆弧」的纯函数**（`composeCubicAsArc`）：过 `P0`、`B(0.5)`、
  `P3` 三点定圆（复用 `composeArcThroughPoints`），扫掠角超过 90° 一律不认（生成侧的不变量），
  按闭式解预测 `C1`、`C2`，两者都落在容差内才认。**控制点落在弦上的三次段是直线**，另一条
  判据、另一个函数。容差**由几何量化推出**而不是凭手感：坐标存到两位小数，识别用到的四个点
  各自最多差半个量子，五个量子（0.05）盖住最坏情形还留一倍余量；任何小于它的偏差在这个产品
  支持的任何缩放下都读不出来。
- **布尔操作数可以自带内外判定用的曲线**（`ComposeBooleanOperand.curve`，可选）。今天的内外
  判定把操作数的片段收成**一条单环**曲线，而一块带岛的填充是两条子路径加 `evenodd`——按单环
  判会把岛也算进去。缺席时行为逐字不变。
- **`stage-engine` 的操作数收集对 `path` 分流**：每条三次段先试直线、再试弧，全部认得出就按
  片段参与运算、以世界坐标的原曲线做内外判定；有一段认不出才以 `bezier` 拒绝。`bezier` 的
  含义因此从「是 `path`」收窄成「含**无法按直线或圆弧表达**的曲线段」——原因码不改，文案改：
  「『X』含自由曲线段，布尔运算只收直线与圆弧」。SVG 导进来的自由曲线仍然拒绝并说明。
- **不走「把贝塞尔拍成折线」**：那会把圆算成多边形，产物看得见棱；与 SVG 导入「非等比下的圆
  MUST NOT 拍扁成多段线」同一条判断。
- **不动 `FLATTEN`**：它不求交，本来就放行 `path`。
- 结果一侧不改：产物仍由 `composeCurveFromOutline` 落最窄 kind，弧边再次落成同一个闭式解的
  贝塞尔，因此**结果可以再当操作数**——往返稳定。

## 影响

- 受影响的规范：`compose-document`（新增：圆弧贝塞尔的识别；新增：操作数自带内外判定曲线）、
  `stage-engine`（修改：`bezier` 拒绝的含义收窄到自由曲线段）、`stage`（修改：那一句拒绝文案）
- 受影响的代码：
  - `packages/core/src/curve-geometry.ts`（新增 `composeCubicAsArc` / `composeCubicAsSegment`）
  - `packages/core/src/curve-boolean.ts`（操作数可选 `curve`）
  - `packages/stage-engine/src/commands/curve-world.ts`（`path` 的世界轮廓按段识别）
  - `packages/stage-engine/src/commands/curve-boolean.ts`（收集操作数时对 `path` 分流）
  - `packages/stage/src/stage-i18n.ts`（`booleanRejectBezier` 文案）
  - `e2e/curve-boolean.spec.ts`（两个圆加三块填充框选求并集）
- 不受影响：`Curve` / `Hatch` 协议与 `schemaVersion`、填充求面与跟随、`FLATTEN`、命中与捕捉、
  `HATCH` 与 `TRIM` 读的世界轮廓（它们走的 `stageWorldOutline` 一行不改）。
- 与在途变更不冲突：`openspec list` 为空。
