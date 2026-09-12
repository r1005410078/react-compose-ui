## 1. 合并规划（stage-engine）

- [x] 1.1 红：`packages/stage-engine/src/commands/wire-merge.test.ts` 写「两条合成一条、远端
      绑定都在」「相接点留下来」「顶点序按需反转」「同一条导线的两端不合并」「跨父级不合并」
      「相接点上还有第三样东西时不合并」六条，确认全红
- [x] 1.2 绿：新增 `packages/stage-engine/src/commands/wire-merge.ts`，导出
      `planStageWireMerge(document, junctionId, options)`——两条支路的顶点在相接点接起来
      （按需反转被并掉的那一条）、远端绑定各自保留、保留场景树里更靠前的那个 Entity、
      删掉另一条。顶点换算走 `translateComposeCurve` 到 parent 局部，不需要布局快照
- [x] 1.3 从包公共入口导出，补 TSDoc（说明为什么保留更靠前的那一条、为什么不消解共线点）

## 2. 节点降到两条支路即合并（stage-engine）

- [x] 2.1 红：`junction-cleanup.test.ts` 补「降到两条支路时两条合回一条」「撤销一次搭接式删除
      回到搭接之前」「同一条导线的两端接在同一个节点上时不合并」，确认全红
- [x] 2.2 绿：`packages/stage-engine/src/commands/junction-cleanup.ts:82` 的
      `remaining.length > 1` 那一支改为：恰好 2 且可合并时追加 `planStageWireMerge` 的命令
      与节点的 `entity.delete`；不可合并时照旧保留
- [x] 2.3 事务标签说明这是一次合并（合并删掉了一个 Entity，日志读不出来时用户只看到场景树少
      了一行）
- [x] 2.4 **实测推翻了提案的前提**：「先画 A→B 再从 B 画到 C」根本没有产出节点——`at-end`
      那一支用 `entity.component.update` 去写一个尚不存在的 `Wire`，被 `component.missing`
      拒掉，而它在一条原子批次里，整次接线静默失败。因此合并要有第二个触发点（见第 8 节）

## 3. 剪断规划（stage-engine）

- [x] 3.1 红：`packages/stage-engine/src/commands/wire-cut.test.ts` 写「中间段剪断成两条」
      「剪口留下看得见的缺口」「两半各自继承绑定与呈现」「端段拒绝」「只有一段拒绝」
      「宿主没声明是导线时不受理」六条，确认全红
- [x] 3.2 绿：新增 `packages/stage-engine/src/commands/wire-cut.ts`，导出
      `planStageWireCut(document, entityId, segmentIndex, options)`——左半 `entity.curve.set`
      在原 Entity 上，右半 `entity.create`，呈现整份复制，剪口两端各为自由端；
      去掉的是整整一段（左半止于 `v[i]`、右半起于 `v[i+1]`）
- [x] 3.3 从包公共入口导出，补 TSDoc（说明为什么不是在一点上断开）

## 4. 顶点删除的两处分流（stage-engine）

- [x] 4.1 红：`vertex-edits.test.ts` 补「绑定端顶点拒绝」「自由端顶点照常删」「导线段夹点不再
      是 unsupported」「普通曲线段夹点仍是 unsupported」，确认全红
- [x] 4.2 绿：`deleteStageCurveVertex` 增加第三个参数
      `options?: { readonly boundEnds?: readonly ('start' | 'end')[]; readonly wire?: boolean }`，
      新增拒绝码 `wire-bound` 与 `cut-edge`；导线段夹点（`m{i}`）不再落到 `unsupported`
- [x] 4.3 更新 `StageVertexEditRejection` 的 TSDoc，把两个新码的理由写在那里

## 5. 宿主接线（stage）

- [x] 5.1 `packages/stage/src/stage-i18n.ts` 补两句文案：`vertexRejectWireBound`
      「这一端绑在端口上，删不掉」、`vertexRejectCutEdge`「只有中间的段可以剪断」，并确认它们
      与既有三句互不相同
- [x] 5.2 `packages/stage/src/geometry-editing/use-stage-vertex-edits.ts`：注入
      `isStageWireEntity` 与该 Entity 的 `Wire` 绑定端；段夹点被点亮且目标是导线时改派
      `planStageWireCut` 的命令而不是走 `entity.curve.set`
- [x] 5.3 确认锁定的导线仍然一个字节不动（`getComposeLock` 那条既有早退）

## 6. 端到端

- [x] 6.1 红：新增 `e2e/wire-merge-and-cut.spec.ts`——「分两次画出的线合成一条」「删掉搭上去的
      那条之后图上没有点、两半合回一条」「点亮中间段按 Delete 剪断且一步撤销」「点亮绑定端顶点
      按 Delete 只出说明」四条；先 `bun run build` 再跑，确认全红
- [x] 6.2 绿：跑通四条。断言在非 100% 缩放下做，取景用 `?no-auto-fit`
- [x] 6.3 全量 `bun run test:e2e` 绿；`grid-layout.spec.ts` 那条已知的载荷敏感 flake 若出现，
      在合并基上复现一次确认不是本变更引入的

## 7. 验证与文档

- [x] 7.1 `bun run lint` / `bun run typecheck` / `bun run test` / `bun run build` 全绿
- [x] 7.2 `openspec validate update-wire-merge-and-cut --strict` 通过
- [x] 7.3 `docs/mockups/wire-modes.html` 里那四处琥珀圈按落地情况收标记，并重发 artifact
      （同一个 URL）

## 8. 绘制期的合并（实测之后补的一节）

- [x] 8.1 红：`wire-tap.test.ts` 写「落在自由端上不建节点，交出一次合并」，并把既有的
      「落在端点上不断线」夹具改成**那一端绑着端口**——原夹具恒写 `Wire: {}`，把真实情形
      （两端都自由的导线不写这个 Component）整个挡在了用例之外
- [x] 8.2 绿：`planStageWireTap` 的返回值拆成 `junction | merge` 两种形状；落点在自由端上
      时交出 `{ kind: 'merge', targetId, end }`
- [x] 8.3 绿：`drafting-entity.ts` 新增 `planStageDraftingWireMerge`——把本次画的这条并进
      既有那条（留下图上先有的那一个），本次这条已经落过地就在同一事务里删掉
- [x] 8.4 绿：`use-stage-drafting.ts` 的提交循环把会话记的「我建的那一个」换成
      `mergedInto`；不换的话「参考点跟着文档走」会读成一次删除、把会话往回退一个点
- [x] 8.5 `entity.curve.set` 上的 `wire: null` 只在 `Wire` 真的在时写——去掉一个不存在的
      Component 会让整条批次被拒（`patch.invalid-path`）。三处都要改：绘制期合并、
      `planStageWireMerge`、`planStageWireCut`
- [x] 8.6 顶点删除交出三档（落地 / 拒绝 / 没有答案）：拒绝时**不**取消夹点会话，否则刚说出来
      的理由被「已取消」冲掉
