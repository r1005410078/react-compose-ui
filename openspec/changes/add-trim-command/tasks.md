## 1. 曲线相交与切片（core）

- [x] 1.1 红：`packages/core/src/curve-geometry.test.ts` 补「线段 × 线段（相交 / 平行 / 共线 / 端点
      相触）」「线段 × 弧（0、1、2 个交点，交点落在扫掠外不算）」「弧 × 弧（同心不算、内切一个点、
      相交两个点）」，确认全红
- [x] 1.2 绿：`curve-geometry.ts` 新增 `intersectComposeSegments` / `intersectComposeSegmentArc` /
      `intersectComposeArcs`，返回交点与各自的参数（线段 `t`、弧的角度）
- [x] 1.3 红：`curve.test.ts` 补「曲线位置参数：line / polyline 的 `{segment, t}`、arc 的角度」
      「按两个位置切出一截：折线中段成两条、端段缩短、闭合折线变开放且顶点从缺口重排、整圆变弧、
      弧变两段弧」「`cornerRadius` 保留」「`path` 拒绝」，确认全红
- [x] 1.4 绿：`curve.ts` 新增 `ComposeCurveLocation`、`locateComposeCurvePoint`、
      `sliceComposeCurve(curve, from, to) → { removed, remaining: ComposeCurve[] }`；从公共入口
      导出，TSDoc 说明为什么按尖角顶点而不是圆角轮廓

## 2. `pick` 输入种类与光标徽标（commands）

- [x] 2.1 红：`pick` 的接受与拒绝由会话自己判，本包没有通用的输入门禁；用例落在
      `stage-engine/src/drafting/trim-command.test.ts`（声明 `pick` 的一步收到 `point` 拒绝、收到
      `selection` 拒绝），先红后绿
- [x] 2.2 绿：`ComposeCommandInputKind` 加 `'pick'`；`ComposeCommandInput` 加
      `{ kind: 'pick'; targets: readonly { id: string; point: ComposeCommandPoint }[] }`；
      `ComposeCommandPrompt` 加可选 `badge?: 'scissors'`
- [x] 2.3 TSDoc：为什么它既不是 `point` 也不是 `selection`；`targets` 为什么是数组

## 3. 截的解算与规划（stage-engine）

- [x] 3.1 红：`packages/stage-engine/src/commands/curve-trim.test.ts` 写「两线相交去掉交点一侧」
      「线穿过矩形挖掉中间成两条」「圆被线穿过变弧」「矩形一条边去掉变开放」「折线中间段成两条、端段
      缩短」「一段上多个交点只掉最近一格」「孤线整条删除」「导线剪到节点后节点清理与合并在同一批
      命令里」「绑定随被去掉的那一截消失」「接线点不是切割边」「不可见 Entity 不是切割边」「整圆只有
      一个交点拒绝」「锁定拒绝」「`path` 拒绝」「非 100% 缩放与非等比盒下交点位置正确」，确认全红
- [x] 3.2 绿：新增 `packages/stage-engine/src/commands/curve-trim.ts`，导出
      `resolveStageTrimPiece(document, index, entityId, worldPoint, options)` 与
      `planStageTrim(index, targets, options)`；世界坐标求交走 `projectComposeCurveToBox`
      + 世界矩阵；`options` 注入 `isWire` / `isJunction` / `idFactory`（接线点的排除复用既有的
      `isJunction`，不另加 `isCuttingEdge`）；多于一条命令时套 batch——实测拖一笔剪两截撤销只回来
      一截，才补的这一条。另新增 `resolveStageTrailTargets`（轨迹与曲线求交）与
      `planStageCurveReplacement`（剪断与修剪共用的落地）
- [x] 3.3 `wire-cut.ts`：去掉「不是导线不受理」，`isWire` 改为可选、只决定绑定继承；闭合折线的
      段去掉即变开放；补用例
- [x] 3.4 `vertex-edits.ts`：段夹点不再按 `options.wire` 门禁，`polyline` 一律交出
      `{ status: 'cut' }`；`cut-edge` 两档照旧；更新 TSDoc 与用例（「普通曲线的段夹点仍然拒绝」
      改成「普通折线的段夹点剪断」）
- [x] 3.5 `drafting-edits.ts`：`StageDraftingEffect` 加 `trim?: readonly { id; point }[]`，
      `planStageDraftingEdits` 调 `planStageTrim`
- [x] 3.6 新增 `packages/stage-engine/src/drafting/trim-command.ts`：`createStageTrimSession`
      （`accepts: ['pick']`、`badge: 'scissors'`，每次 `pick` 交出 `commit` 且提示不变，`accept` /
      `cancel` 结束，不读启动上下文的选择集）与 `createStageTrimCommand`（`id: 'TRIM'`、
      `aliases: ['TR']`、编辑分组）；加进 `createStageDraftingCommands` 与公共入口；补用例

## 4. 宿主接线（stage）

- [x] 4.1 `stage-i18n.ts` 补：`trimTitle`、`trimPrompt`「选择要修剪的一截，或按住拖过多条（回车
      结束）:」、`trimDragging`「松手即修剪，Escape 放弃这一笔:」、`trimRejectLocked`、
      `trimRejectJunction`、`trimRejectNotCurve`、`trimRejectPath`、`trimRejectCircle`，确认互不相同
- [x] 4.2 `use-stage-drafting.ts`：`awaitingPick` 派生自 `prompt.accepts.includes('pick')`；等待
      `pick` 时 `pointerdown` 按拾取框容差取**离光标最近**的曲线 Entity（不改选择集）；按下不动
      松手即一次 `pick`；指针离开过按下点即进入拖动，轨迹与视口内曲线求交、`pointerup` 时作为
      一次 `pick`（去重）；拖动中 `Escape` 放弃这一笔
- [x] 4.3 `use-stage-drafting.ts`：等待 `pick` 时用 `resolveStageTrimPiece` 算悬停预览。纯函数只读
      索引与文档、不读会话 ref，因此在 `useMemo` 里算而不是 `useLayoutEffect`
- [x] 4.4 `stage-drafting-overlay.tsx`：画幽灵（Entity 自己的描边色点画 + 画布底色压淡）、两头
      剪口（`--stage-trim-cut`，与线垂直的短划）、拖动轨迹（accent 点画）；`styles.css` 加 token
- [x] 4.5 `compose-stage.tsx`：`box` 的判据加上 `awaitingPick`；徽标按 `prompt.badge` 在
      `crosshair` 非空时画在框的右下、刀尖指向框；隐藏系统光标的来源不变
- [x] 4.6 新增 `stage-engine/src/drafting/drafting-pick-plugin.ts`（优先级 1640，紧随取点插件之下、
      仍在 `pan` 之下）：按下不动松手是点一下，指针离开过按下点即一笔轨迹，逐帧回传
      `drafting.pick-trail`、松手回传 `drafting.pick`；拖动中 `Escape` 走内核 `pointer.cancel`
- [x] 4.7 `use-stage-vertex-edits.ts`：普通折线的段夹点 `Delete` 改派 `planStageWireCut`（现已
      不限导线），落地文案「剪断 {name}」不变

## 5. 货架（editor）

- [x] 5.1 `toolbar-shelf.ts`：目录加 `{ id: 'TRIM', messageKey: 'trim', icon: 'trim',
      entrance: { kind: 'command' } }`；绘图货架在 `WIRE` 之后、分割线之前插入 `TRIM`；页面货架不加
- [x] 5.2 图标与 `editor-i18n.ts` 文案（中英）；`toolbar-shelf.test.ts` 的「每一格声明第二条入口」
      用例自然覆盖新的一格

## 6. 端到端

- [x] 6.1 红：新增 `e2e/trim-command.spec.ts`——七条（两线相交、线穿过矩形且撤销一步、圆变弧、矩形
      变开放、拖过多条一个事务、拾取框加徽标且悬停预览出现即消失、接线点在命令行说明）。落点一律
      从 Stage 当前变换换算，因此走默认路由（自动适配给出非 100% 缩放）而不是 `?no-auto-fit`；
      坐标全部键入，角度约束因此不必关。首跑三条红：缩放断言、一笔两截撤销只回一截（引擎没套
      batch）、键入坐标不接入节点（要用指针取点）
- [x] 6.2 绿：跑通七条。全量端到端首跑 6 红：5 条是与单测并跑时的超时（单独重跑全绿），1 条是
      `wire-merge-and-cut.spec.ts` 里剪断后按 `<polyline>` 计数——两点导线现在取最窄 kind 画成
      `<line>`，用例改口为数 `<line>` 并按端点距离断缺口

## 7. 验证与文档

- [x] 7.1 `bun run lint` / `bun run typecheck` / `bun run test` / `bun run build` 全绿
- [x] 7.2 `openspec validate add-trim-command --strict` 通过
- [x] 7.3 `docs/mockups/drafting-trim.html` 的琥珀圈按落地情况收成绿圈，并重发 artifact（同一个 URL）
- [x] 7.4 `AGENTS.md` 的曲线段落补一条「修剪」：边界三级、`pick` 不是点也不是选择、徽标不换光标
- [x] 7.5 `bun run lint` / `typecheck` / `test` / `build` 与全量端到端都跑过一遍
