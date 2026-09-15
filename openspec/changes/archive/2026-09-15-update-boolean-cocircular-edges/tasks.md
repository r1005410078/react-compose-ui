> 段 1 是纯函数与它的三件配套（三件缺一不可，因此同一段里落地）。段 2 把量化步长从调用方接进来。
> 段 3 是用户报的那张图。

## 1. 支撑归一与它的三件配套（core）

- [x] 1.1 `curve-arrangement.ts`：片段 → 支撑（线段给规范式 `(nx, ny, c)`，弧给 `(cx, cy, r)`），
      规范式的法向定向定死——共线的两条因此得到同一组数
- [x] 1.2 `curve-arrangement.ts`：按**共同拟合的残差**分组（两条片段的取样点放在**一起**拟合出
      一条支撑，最大残差 ≤ 一个量化步长），分组取**连通分量**；规范支撑是整组取样点的共同拟合，
      成员全部重算到它上面；组内本来就逐位同支撑时原样留着
- [x] 1.3 `buildGraph`：同一支撑组内的两条片段不求交，改为按对方端点切开
- [x] 1.4 `buildGraph`：节点合并容差取「相对量」与「`2√2` 个量化步长」的较大者
      （`composeNodeEpsilon`，两个调用方共用）；零长子边一律丢弃（不再只丢线段）
- [x] 1.5 单测（判别性）：
      - 两条圆心差三个量化步长、共同拟合残差只差半个步长的弧归到同一条支撑；
      - 差得开的两条弧**不**归一，差半个量级的两条平行线**不**归一；
      - 同一组片段换输入顺序，归一之后逐位相同；
      - **只抬节点容差收不掉重复的边，归一才收得掉**（钉住「这一条单独不成立」）；
      - 零长的弧子边不进图

      > Red command: `bunx vitest run src/curve-support-weld.test.ts`（packages/core）
      > Red result: 5 failed | 3 passed (8)，失败全是断言（支撑不相等 / 重复没收掉 / 零长边还在）
      > Red reason: `weldComposeOutlineSupports` 与 `composeOutlineSupport` 先落了桩（原样返回、
      >   线段支撑恒为零），因此 Red 由**断言**产生而不是 `TypeError`——后者属于「依赖缺失」，
      >   按 project.md 不算有效 Red。
      > Green command: 同上
      > Green result: 8 passed
      > Regression command: `bunx vitest run`（packages/core）
      > Regression result: 561 passed
      >
      > 桩上有一条**假绿**：线段支撑恒返回同一个常量时「方向相反的两条共线线段归到同一条支撑」
      > 自动成立。补了一条反向用例（差半个量级的两条平行线不归一）之后它才真的判别。
      > 另一处：法向定向要把 `-0` 归正——`-0` 与 `0` 在比较里相等，却让同一条支撑在逐位比较下
      > 读成两条。

## 2. 量化步长由调用方给出（core 入口 + stage-engine）

- [x] 2.1 `resolveComposeCurveRegion` 与 `resolveComposeCurveBoolean` 接受量化步长，缺省取
      `COMPOSE_GEOMETRY_QUANTUM`，一路传到 `buildGraph`
- [x] 2.2 `stage-engine`：`collectOperands` 与 `curve-hatch.ts` 各自算出世界量化步长
      （`stageWorldQuantum` = 文档步长 × 盒/取景框 × `sqrt(|det|)`），多个操作数取最大；
      `core/hatch-solve.ts` 的跟随求解同样按盒/取景框折算
- [x] 2.3 单测（判别性）：一个盒放大到取景框十倍的操作数，交下去的步长是十倍

      > Green command: `bunx vitest run src/commands/curve-boolean.test.ts`（packages/stage-engine）
      > Green result: 18 passed
      >
      > 「多个操作数取最大」那条场景写得比能验的更强，落地时**改了规范**：两个操作数的盒缩放
      > 不同时它们的世界几何本来就不落在同一处，构不出「共享一段边界而两边精度不同」的夹具。
      > 中间写过一条只断「大于零」的用例，删掉了——断不出东西的用例比不写更糟。

## 3. 用户报的那张图（stage + e2e）

- [x] 3.1 单测：两块面各走一遍文档往返求并集，产物包围盒等于整个左圆（**断尺寸而不是断
      「算出来了」**——上一个变更就是在这里被一个几像素大的退化产物骗过）；同一批操作数在步长
      为零时仍退化，那是修复之前的行为。`stage-engine` 侧另有一条走完整条落地管线的同名用例
- [x] 3.2 端到端两条：①两块共用弧边界的填充求并集，产物拿圆当尺子断比例（既有那条「给出可见
      拒绝」的用例改写成**算得出来**）；②用户那张图的原样手势——两个圆、三块填充、框选全部求
      并集，断**尺寸差**（量到的是含描边的墨，相减把描边那个常数抵掉）

      > 判据在这一段返工了一次，**改规范在改实现之前**：
      > 第一版判据「A 的取样点到 B 拟合出来的支撑的偏差」在半径 60 的单测夹具上成立，换到端到端
      > 用的半径 120 就不成立——那张图上同一个圆的边界被切成五条子弧，两两偏差最大 **0.054**，
      > 是点本身存储误差的五倍还多。原因是它在**外推**：短弧反解出来的圆，圆心误差被放大
      > `1/(1−cos(θ/2))` 倍，而放大倍数由弧的跨度决定，于是容差没有可推导的来源。
      > 改成**共同拟合的残差**（内插）之后量了三档半径：同圆 ≤ 5.7e-3 且不随半径漂移，异圆
      > ≥ 5.76，容差取一个量化步长是推出来的而不是试出来的。
      >
      > 另两处返工：①归一在**纯重复**的两条边上引入了 1e-14 的浮点噪声（`curve-region` 那条
      > 「共线重叠」用例当场变红）——组内本来就逐位同支撑时原样留着。②端到端的框选起点落到了
      > 图面之外，选区是空的而提示只写「选择对象:」；把夹具缩到可视区内。
      >
      > Green command: `bun run test:e2e -- e2e/curve-boolean.spec.ts`
      > Green result: 9 passed

- [x] 3.3 门禁：lint、typecheck、单测、构建、端到端

      > `bun run lint` EXIT 0；`bun run typecheck` EXIT 0；`bun run build` EXIT 0；
      > `bun run test:e2e` EXIT 0（367 passed）。
      > `bun run test` 在并行满载下报 `@compose-ui/editor#test` 一条失败
      > （`page-workspace.test.tsx` 的「镜像清单未变化时保存不回写动画文件」，`act` 里等一个
      > 异步保存超时），单独跑 42 files / 419 tests 全过。它与本变更没有交集——那条用例一个
      > 曲线都不碰。本仓库这一轮已多次观测到同类只在并行负载下出现的超时。
