> 每一段是一条可运行的纵向流程。段 1 是纯函数，段 2 把它接进解算，段 3 是文案与端到端。

## 1. 圆弧贝塞尔的识别（core）

- [ ] 1.1 `curve-geometry.ts`：`composeCubicAsSegment`——控制点落在弦上（叉积近零且投影在
      `[0, 1]` 内）即直线段
- [ ] 1.2 `curve-geometry.ts`：`composeCubicAsArc`——过 `P0`、`B(0.5)`、`P3` 定圆，扫掠取经过
      中点的那一侧且不超过 90°，按闭式解预测两个控制点，都在 `CUBIC_ARC_TOLERANCE` 内才认
- [ ] 1.3 单测（判别性）：`composeArcToCubicShapes` 生成、再经 `roundComposeGeometry` 舍入
      之后的每一段都认回同一个圆（半径 2 到 500、扫掠 5° 到 90°、两个方向）；控制点落在弦上
      的段认成直线；一条自由贝塞尔（把 `C1` 挪开 0.5）不认；一段 120° 的弧手工凑成一条三次段
      不认（超过 90°）

## 2. 解算接受由弧围成的路径（core + stage-engine）

- [ ] 2.1 `curve-boolean.ts`：`ComposeBooleanOperand.curve` 可选，内外判定优先读它
- [ ] 2.2 单测（判别性）：一个带岛的 `evenodd` 操作数（外环加一个内环）与一个落在岛里的
      矩形求交集——传 `curve` 时结果为空，不传时旧行为把岛算进去
- [ ] 2.3 `curve-world.ts`：`stageWorldRings`——`path` 逐段识别成片段，认不出返回 `null`；
      其余 kind 复用 `stageWorldOutline`。**`stageWorldOutline` 一行不改**，`HATCH` 与 `TRIM`
      读的仍是它
- [ ] 2.4 `commands/curve-boolean.ts`：`collectOperands` 对 `path` 走 2.3；认不出才 `bezier`
- [ ] 2.5 单测（判别性）：两个圆填出来的三块面（几何由 `resolveComposeCurveRegion` 真求出来，
      不手写）全选求并集得到一个圆的并集；两块相邻填充求交集为空；SVG 风格的自由贝塞尔仍以
      `bezier` 拒绝并带名称；结果再当操作数能算

## 3. 文案与端到端（stage）

- [ ] 3.1 `stage-i18n.ts`：`booleanRejectBezier` 改成「『X』含自由曲线段，布尔运算只收直线与
      圆弧」，中英各一份
- [ ] 3.2 端到端：两个圆、油漆桶填三块面、框选全部、`UNION`——场景树只剩一行，图上是一条
      `path`；再对它与一个矩形求交集，能算
- [ ] 3.3 门禁：lint、typecheck、单测、构建、端到端
