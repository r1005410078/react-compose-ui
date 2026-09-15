> 段 1 是解算交回的形状变了，段 2 是落地规划，段 3 是端到端与门禁。

## 1. 解算逐个交回（stage-engine）

- [x] 1.1 `resolveStageFlatten` 交回**逐操作数**的几何（`StageFlattenResolution.pieces`，
      每条一个 `path`），不再交回一条合并的；区域运算那一条解算一个字节不动
- [x] 1.2 单测（判别性）：三个形状拍平交回三条几何、顺序与层序一致；一个闭合多段线与一个整圆
      各交回一条 `path`；一个操作数时行为与此前逐字相同

      > Green command: `bun run test --filter @compose-ui/stage-engine`
      > Green result: 678 passed

## 2. 逐个原地落地（stage）

- [x] 2.1 `boolean-plan.ts`：拍平不再按操作数个数分支，一律逐个 `planInPlace`；
      `planInPlace` 交回**平的**一列命令，由 `planStageFlatten` 批**一次**
- [x] 2.2 拍平不挪选区：`resultId` 改成 `resultIds`（一列），拍平填的是那几个操作数、
      区域运算填的是新建出来那一个；区域运算的挪法一个字节不动
- [x] 2.3 单测（判别性）：拍平两块颜色不同的填充 → 仍是两个 Entity、两种颜色各自留着、
      两条几何都变成 `path`，且只有一条 batch 命令；拍平一个圆与一个矩形两条都变 `path`；
      **事务只批一层**（子命令里没有 batch）

      > Red command: `bun run test --filter @compose-ui/stage`
      > Red result: 1 failed，`AssertionError: expected 'create' to be 'in-place'`
      > Red reason: 拍平那时还走合并分支。Red 由**断言**产生。
      > Green command: 同上
      > Green result: 444 passed
      >
      > 两条既有用例改了归属：「多个操作数合并成一个新对象」与「合并产物的外观与名称取层序
      > 最靠后那个操作数」原先用 `planStageFlatten` 验合并，现在改用 `planStageBoolean` 的
      > 并集——合并是**区域运算**的语义。

## 3. 端到端与门禁

- [x] 3.1 端到端：画两个圆、填两块颜色不同的面，框选四个对象拍平——四个对象都还在，
      两块填充的 `fill` 各自不变，两个圆仍然 `fill=none`（这是合并语义的第二处症状，
      只断颜色会漏掉「透明的地方被填实」）；撤销一步四条一起回去

      > **这一段抓住了一处只有端到端拦得住的缺陷。** 单测全绿而浏览器里**什么都没发生**：
      > `transaction.batch` 明令不许嵌套（`asBatchCommands` 见到子命令还是 batch 就整条拒绝），
      > 而第一版实现让每个操作数先把「几何写入 + `Hatch` 删除」批一层、再批进外层。
      > 拒绝发生在**派发**那一层而不是规划那一层，因此规划层看起来一切正常——命令有了、分支
      > 对了、撤销也是一步——命令行也不说话。
      >
      > 查它花的功夫也记在这里：先后排除了「框选没选中圆」「圆拍不平」两条错误猜测（单个圆
      > 在浏览器里拍得平），最后靠在派发处临时打印 `dispatch` 的返回值才看见 `rejected` 与
      > 载荷里那层嵌套的 batch。**教训**：规划层的用例断不出派发层的拒绝，因此补了一条
      > 结构用例直接断「子命令里没有 batch」。
      >
      > Green command: `bun run test:e2e -- e2e/curve-boolean.spec.ts`
      > Green result: 10 passed

- [ ] 3.2 门禁：lint、typecheck、单测、构建、端到端
