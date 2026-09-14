> 每一段是一条可运行的纵向流程。段 1 是纯函数，段 2 把它接进解算，段 3 是文案与端到端。

## 1. 圆弧贝塞尔的识别（core）

- [ ] 1.1 `curve-geometry.ts`：`composeCubicAsSegment`——控制点落在弦上（到弦的距离在容差内
      且投影落在 `[0, 1]` 内）即直线段
- [ ] 1.2 `curve-geometry.ts`：`composeCubicAsArc`——过 `P0`、`B(0.5)`、`P3` 定圆，扫掠取经过
      中点的那一侧且不超过 90°（放宽量由 `容差/半径` 推出），再在曲线上取样验证每点到圆心的
      距离与方位角。**验证落在轨迹上而不是拟合参数上**——浅弧的半径由矢高反解，舍入能让它差
      出几成，而形状误差仍只有舍入那么大
- [ ] 1.3 单测（判别性）：`composeArcToCubicShapes` 生成、再经 `roundComposeGeometry` 舍入
      之后的每一段都认回同一段弧（半径 2 到 500、扫掠 15° 到 90°、两个方向，按**轨迹**断言
      而不是按圆心半径）；半径 2、扫掠 5° 的弧认成直线（矢高不到量化步长的五分之一）；控制点
      落在弦上的段认成直线；一条自由贝塞尔不认；一段 120° 的弧凑成一条三次段不认；冲过终点
      再折返的段不认

## 2. 解算接受由弧围成的路径（core + stage-engine）

- [ ] 2.1 `curve-boolean.ts`：`ComposeBooleanOperand.curve` 可选，内外判定优先读它
- [ ] 2.2 单测（判别性）：一个带岛的 `evenodd` 操作数（外环加一个内环）与一个落在岛里的
      矩形求交集——传 `curve` 时结果为空，不传时旧行为把岛算进去
- [ ] 2.3 `core/curve.ts`：`composePathAsOutline`——`path` 逐条三次段识别成片段，有一段认不出
      即返回 `null`。**住 core 而不是 `curve-world.ts`**（原计划）：它一个 stage 概念都不认识，
      只是几何。**`stageWorldOutline` 一行不改**，`HATCH` 与 `TRIM` 读的仍是它
- [ ] 2.4 `commands/curve-boolean.ts`：`collectOperands` 对 `path` 走 2.3（在**世界**曲线上做，
      非等比盒把弧投影成椭圆弧，认不出即 `bezier`，这是对的）；认不出才 `bezier`
- [ ] 2.5 单测（判别性）：两个圆填出来的三块面（几何由 `resolveComposeCurveRegion` 真求出来，
      不手写）全选求并集得到一个圆的并集；两块相邻填充求交集为空；SVG 风格的自由贝塞尔仍以
      `bezier` 拒绝并带名称；结果再当操作数能算

## 3. 文案与端到端（stage）

- [ ] 3.1 `stage-i18n.ts`：`booleanRejectBezier` 改成「『X』含自由曲线段，布尔运算只收直线与
      圆弧」，中英各一份
- [ ] 3.2 端到端：两个圆、油漆桶填三块面、框选全部、`UNION`——场景树只剩一行，图上是一条
      `path`；再对它与一个矩形求交集，能算
- [ ] 3.3 门禁：lint、typecheck、单测、构建、端到端
