> 每一段是一条可运行的纵向流程。段 1 是纯函数，段 2 把它接进解算，段 3 是文案与端到端。

## 1. 圆弧贝塞尔的识别（core）

- [x] 1.1 `curve-geometry.ts`：`composeCubicAsSegment`——控制点落在弦上（到弦的距离在容差内
      且投影落在 `[0, 1]` 内）即直线段
- [x] 1.2 `curve-geometry.ts`：`composeCubicAsArc`——过 `P0`、`B(0.5)`、`P3` 定圆，扫掠取经过
      中点的那一侧且不超过 90°（放宽量由 `容差/半径` 推出），再在曲线上取样验证每点到圆心的
      距离。**验证落在轨迹上而不是拟合参数上**——浅弧的半径由矢高反解，舍入能让它差
      出几成，而形状误差仍只有舍入那么大
- [x] 1.3 单测（判别性）：`composeArcToCubicShapes` 生成、再经 `roundComposeGeometry` 舍入
      之后的每一段都认回同一段弧（半径 2 到 500、扫掠 30° 到 90°、两个方向，按**轨迹**断言
      而不是按圆心半径）；半径 2、扫掠 5° 的弧认成直线（矢高不到量化步长的五分之一）；控制点
      落在弦上的段认成直线；S 形的自由贝塞尔不认；一段 120° 的弧凑成一条三次段不认

      > Red command: `bunx vitest run src/cubic-arc-recognition.test.ts`（packages/core）
      > Red result: 26 failed | 4 passed (30)，失败全是 `AssertionError: expected null not to be null`
      > Red reason: 两个识别函数只有签名与契约、函数体是 `return null`，目标行为尚未实现。
      >   先落桩再跑，是为了让 Red 由**断言**产生——直接引用未定义的函数得到的是 `TypeError`，
      >   那属于「依赖缺失」，按 project.md 不算有效 Red。
      > Green command: 同上
      > Green result: 30 passed (30)
      > Regression command: `bunx tsc --noEmit -p packages/core`
      > Regression result: exit 0
      >
      > 落地时推翻了提案里的一条判据，并在实现前改了规范（提交 `aabad0dd`）：原方案「按闭式解
      > 预测两个控制点再比对」在浅弧上不成立——半径由矢高反解，而矢高只有几个量化步长，舍入能
      > 让半径差出几成，预测出来的控制点跟着差出容差之外，于是**真实的产品几何会被拒**。改成
      > 在曲线上取样验证轨迹：三点定出的圆与真弧在三处吻合、中间也就处处吻合，这是拟合在函数
      > 意义上稳定而在参数意义上不稳定的标准情形。
      >
      > 另一处：`composeCubicAsArc` **单独不是分类器**，极浅的弧它也会认（整段只跨 0.17 个
      > 单位时，几乎共线的三点定出的圆半径没有意义、轨迹却仍在容差内）。挡住那一档的是
      > 「先问直线」的次序，因此那条用例刻意不断言它返回 null，并把理由写在用例注释里。

## 2. 解算接受由弧围成的路径（core + stage-engine）

- [x] 2.1 `curve-boolean.ts`：`ComposeBooleanOperand.curve` 可选，内外判定优先读它
- [x] 2.2 单测（判别性）：一个带岛的 `evenodd` 操作数（外环加一个内环）与一个落在岛里的
      矩形求交集——传 `curve` 时结果为空，不传时旧行为把岛算进去
- [x] 2.3 `core/curve.ts`：`composePathAsOutline`——`path` 逐条三次段识别成片段，有一段认不出
      即返回 `null`。**住 core 而不是 `curve-world.ts`**（原计划）：它一个 stage 概念都不认识，
      只是几何。**`stageWorldOutline` 一行不改**，`HATCH` 与 `TRIM` 读的仍是它
- [x] 2.4 `commands/curve-boolean.ts`：`collectOperands` 对 `path` 走 2.3（在**世界**曲线上做，
      非等比盒把弧投影成椭圆弧，认不出即 `bezier`，这是对的）；认不出才 `bezier`
- [x] 2.5 单测（判别性）：两个圆填出来的三块面（几何由 `resolveComposeCurveRegion` 真求出来，
      不手写）全选求并集得到一个圆的并集；两块相邻填充求交集为空；SVG 风格的自由贝塞尔仍以
      `bezier` 拒绝并带名称；结果再当操作数能算

      > **2.1 / 2.2**
      > Red command: `bunx vitest run src/curve-boolean.test.ts`（packages/core）
      > Red result: 1 failed | 23 passed，`AssertionError: expected 'resolved' to be 'empty'`
      > Red reason: `ComposeBooleanOperand.curve` 只有类型声明，解算还没有读它——带岛的操作数
      >   把洞算成实心，落在洞里的矩形被判成相交。先加字段再跑，Red 因此由断言而不是类型错误
      >   产生。
      > Green command: 同上
      > Green result: 24 passed
      >
      > **2.3**
      > Red command: `bunx vitest run src/cubic-arc-recognition.test.ts`（packages/core，
      >   把 `composePathAsOutline` 的函数体临时换成 `return null`）
      > Red result: 2 failed | 31 passed，`AssertionError: expected null not to be null`
      > Red reason: 这一条的实现先于用例写出，因此用**退回桩**的方式补验判别性——两条正向
      >   用例（整圆认回四段弧、圆角矩形认回四直边加四角弧）在桩上必红。
      > Green command: 同上（恢复实现）
      > Green result: 33 passed
      >
      > **2.4 / 2.5**
      > Red command: `bunx vitest run src/commands/curve-boolean.test.ts`（packages/stage-engine）
      > Red result: 4 failed | 12 passed，三条 `expected 'rejected' to be 'resolved'`、一条
      >   `expected { status: 'rejected' } to match { reason: 'empty' }`
      > Red reason: `collectOperands` 还在 `curve.kind === 'path'` 那一行整个拒掉。
      > Green command: 同上
      > Green result: 16 passed
      >
      > 交集那条**断的是透镜形的尺寸**（宽 40、高 80）而不是「算出来了」：把弧拍成折线同样
      > 算得出来，而尺寸对不上正是棱的直接后果。

## 3. 文案与端到端（stage）

- [x] 3.1 `stage-i18n.ts`：`booleanRejectBezier` 改成「『X』含自由曲线段，布尔运算只收直线与
      圆弧」，中英各一份
- [x] 3.2 端到端：两个圆、油漆桶填三块面、框选全部、`UNION`——场景树只剩一行，图上是一条
      `path`；再对它与一个矩形求交集，能算
- [ ] 3.3 门禁：lint、typecheck、单测、构建、端到端
