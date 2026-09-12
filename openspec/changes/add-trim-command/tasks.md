## 1. 曲线相交与切片（core）

- [ ] 1.1 红：`packages/core/src/curve-geometry.test.ts` 补「线段 × 线段（相交 / 平行 / 共线 / 端点
      相触）」「线段 × 弧（0、1、2 个交点，交点落在扫掠外不算）」「弧 × 弧（同心不算、内切一个点、
      相交两个点）」，确认全红
- [ ] 1.2 绿：`curve-geometry.ts` 新增 `intersectComposeSegments` / `intersectComposeSegmentArc` /
      `intersectComposeArcs`，返回交点与各自的参数（线段 `t`、弧的角度）
- [ ] 1.3 红：`curve.test.ts` 补「曲线位置参数：line / polyline 的 `{segment, t}`、arc 的角度」
      「按两个位置切出一截：折线中段成两条、端段缩短、闭合折线变开放且顶点从缺口重排、整圆变弧、
      弧变两段弧」「`cornerRadius` 保留」「`path` 拒绝」，确认全红
- [ ] 1.4 绿：`curve.ts` 新增 `ComposeCurveLocation`、`locateComposeCurvePoint`、
      `sliceComposeCurve(curve, from, to) → { removed, remaining: ComposeCurve[] }`；从公共入口
      导出，TSDoc 说明为什么按尖角顶点而不是圆角轮廓

## 2. `pick` 输入种类与光标徽标（commands）

- [ ] 2.1 红：`command-types.test.ts`（或既有会话用例）补「声明 `pick` 的一步收到 `pick` 推进、
      收到 `point` 拒绝」「没声明 `pick` 的一步收到 `pick` 拒绝」，确认全红
- [ ] 2.2 绿：`ComposeCommandInputKind` 加 `'pick'`；`ComposeCommandInput` 加
      `{ kind: 'pick'; targets: readonly { id: string; point: ComposeCommandPoint }[] }`；
      `ComposeCommandPrompt` 加可选 `badge?: 'scissors'`
- [ ] 2.3 TSDoc：为什么它既不是 `point` 也不是 `selection`；`targets` 为什么是数组

## 3. 截的解算与规划（stage-engine）

- [ ] 3.1 红：`packages/stage-engine/src/commands/curve-trim.test.ts` 写「两线相交去掉交点一侧」
      「线穿过矩形挖掉中间成两条」「圆被线穿过变弧」「矩形一条边去掉变开放」「折线中间段成两条、端段
      缩短」「一段上多个交点只掉最近一格」「孤线整条删除」「导线剪到节点后节点清理与合并在同一批
      命令里」「绑定随被去掉的那一截消失」「接线点不是切割边」「不可见 Entity 不是切割边」「整圆只有
      一个交点拒绝」「锁定拒绝」「`path` 拒绝」「非 100% 缩放与非等比盒下交点位置正确」，确认全红
- [ ] 3.2 绿：新增 `packages/stage-engine/src/commands/curve-trim.ts`，导出
      `resolveStageTrimPiece(document, index, entityId, worldPoint, options)` 与
      `planStageTrim(document, index, targets, options)`；世界坐标求交走 `projectComposeCurveToBox`
      + 世界矩阵；`options` 注入 `isWire` / `isCuttingEdge` / `idFactory`
- [ ] 3.3 `wire-cut.ts`：去掉「不是导线不受理」，`isWire` 改为可选、只决定绑定继承；闭合折线的
      段去掉即变开放；补用例
- [ ] 3.4 `vertex-edits.ts`：段夹点不再按 `options.wire` 门禁，`polyline` 一律交出
      `{ status: 'cut' }`；`cut-edge` 两档照旧；更新 TSDoc 与用例（「普通曲线的段夹点仍然拒绝」
      改成「普通折线的段夹点剪断」）
- [ ] 3.5 `drafting-edits.ts`：`StageDraftingEffect` 加 `trim?: readonly { id; point }[]`，
      `planStageDraftingEdits` 调 `planStageTrim`
- [ ] 3.6 新增 `packages/stage-engine/src/drafting/trim-command.ts`：`createStageTrimSession`
      （`accepts: ['pick']`、`badge: 'scissors'`，每次 `pick` 交出 `commit` 且提示不变，`accept` /
      `cancel` 结束，不读启动上下文的选择集）与 `createStageTrimCommand`（`id: 'TRIM'`、
      `aliases: ['TR']`、编辑分组）；加进 `createStageDraftingCommands` 与公共入口；补用例

## 4. 宿主接线（stage）

- [ ] 4.1 `stage-i18n.ts` 补：`trimTitle`、`trimPrompt`「选择要修剪的一截，或按住拖过多条（回车
      结束）:」、`trimDragging`「松手即修剪，Escape 放弃这一笔:」、`trimRejectLocked`、
      `trimRejectJunction`、`trimRejectNotCurve`、`trimRejectPath`、`trimRejectCircle`，确认互不相同
- [ ] 4.2 `use-stage-drafting.ts`：`awaitingPick` 派生自 `prompt.accepts.includes('pick')`；等待
      `pick` 时 `pointerdown` 按拾取框容差取**离光标最近**的曲线 Entity（不改选择集）；按下不动
      松手即一次 `pick`；指针离开过按下点即进入拖动，轨迹与视口内曲线求交、`pointerup` 时作为
      一次 `pick`（去重）；拖动中 `Escape` 放弃这一笔
- [ ] 4.3 `use-stage-drafting.ts`：等待 `pick` 时 `pointermove` 用 `resolveStageTrimPiece` 算悬停
      预览，读 ref 里的会话状态、在 `useLayoutEffect` 里算
- [ ] 4.4 `stage-drafting-overlay.tsx`：画幽灵（Entity 自己的描边色点画 + 画布底色压淡）、两头
      剪口（`--stage-trim-cut`，与线垂直的短划）、拖动轨迹（accent 点画）；`styles.css` 加 token
- [ ] 4.5 `compose-stage.tsx`：`box` 的判据加上 `awaitingPick`；徽标按 `prompt.badge` 在
      `crosshair` 非空时画在框的右下、刀尖指向框；隐藏系统光标的来源不变
- [ ] 4.6 取点插件与 `pick` 的仲裁：等待 `pick` 时 `drafting-point` 插件不接管（它只认
      `awaitingPoint`），`pick` 由 Stage 在同一优先级上另起一个 claim，仍排在 `pan` 之下
- [ ] 4.7 `use-stage-vertex-edits.ts`：普通折线的段夹点 `Delete` 改派 `planStageWireCut`（现已
      不限导线），落地文案「剪断 {name}」不变

## 5. 货架（editor）

- [ ] 5.1 `toolbar-shelf.ts`：目录加 `{ id: 'TRIM', messageKey: 'trim', icon: 'trim',
      entrance: { kind: 'command' } }`；绘图货架在 `WIRE` 之后、分割线之前插入 `TRIM`；页面货架不加
- [ ] 5.2 图标与 `editor-i18n.ts` 文案（中英）；`toolbar-shelf.test.ts` 的「每一格声明第二条入口」
      用例自然覆盖新的一格

## 6. 端到端

- [ ] 6.1 红：新增 `e2e/trim-command.spec.ts`——「两线相交点一侧，横线缩到交点」「线穿过矩形点
      中间，一条变两条且撤销一步」「圆被线穿过点上半，圆变弧」「矩形点一条边变开放」「拖过多条一个
      事务」「悬停出预览、离开即消失」「等待 pick 时画拾取框与徽标、不画十字线」「点接线点在命令行
      说明」；`?no-auto-fit`、`angleConstraint: 'off'`，断言在非 100% 缩放下做；先 `bun run build`
      再跑，确认全红
- [ ] 6.2 绿：跑通全部；全量 `bun run test:e2e` 绿

## 7. 验证与文档

- [ ] 7.1 `bun run lint` / `bun run typecheck` / `bun run test` / `bun run build` 全绿
- [ ] 7.2 `openspec validate add-trim-command --strict` 通过
- [ ] 7.3 `docs/mockups/drafting-trim.html` 的琥珀圈按落地情况收成绿圈，并重发 artifact（同一个 URL）
- [ ] 7.4 `AGENTS.md` 的曲线段落补一条「修剪」：边界三级、`pick` 不是点也不是选择、徽标不换光标
