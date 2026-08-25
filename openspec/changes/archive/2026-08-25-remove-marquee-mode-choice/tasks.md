# Tasks

## 1. 判别性用例先验红

- [x] 1.1 e2e：断言工具栏上**没有**框选模式菜单的触发器。**先跑确认红**——今天它在
- [x] 1.2 回归：两个方向的判定与分色照旧（上一刀的两条用例仍须全绿）
- [x] 1.3 形状工具的 split button 不受牵连：菜单仍能展开并切换矩形/箭头/圆

## 2. `stage-engine`：收窄类型

- [x] 2.1 `StageMarqueeMode` → `StageMarqueeHitTest`，取值收成 `contain | intersect`
- [x] 2.2 `resolveMarqueeHitTest(direction)` 只收方向；删 `DEFAULT_STAGE_MARQUEE_MODE`
- [x] 2.3 `resolveMarqueeSelection` 的查询去掉 `mode`
- [x] 2.4 `StageInteractionContext.marqueeMode` 删除
- [x] 2.5 Vitest 逐条改到新签名

## 3. `stage`：去掉受控 prop

- [x] 3.1 `policy.marqueeMode` 与 `ComposeStageProps.marqueeMode` 删除
- [x] 3.2 `ComposeStageMarqueeMode` 从公共入口删除；覆盖层类型改用 `StageMarqueeHitTest`
- [x] 3.3 组件测试里传 `marqueeMode` 的地方**一律改成用方向表达意图**（要相交就从右往左拖），
      而不是给测试留一个后门参数——后门会让「产品里没有开关」这条在测试里不成立

## 4. `editor`：删菜单

- [x] 4.1 工具栏去掉 chevron 触发器、菜单、`marqueeMode`/`setMarqueeMode` 两个 prop 与
      `data-active-marquee-mode`；选择回到普通按钮
- [x] 4.2 controller 去掉 `marqueeMode` 状态与 policy 字段
- [x] 4.3 i18n 去掉 `marqueeMode` / `marqueeIntersect` / `marqueeContain` / `marqueeDirectional`
- [x] 4.4 三个 marquee 图标若因此无消费者则一并删除

## 5. 规范与文档

- [x] 5.1 四份规范增量（已写），含两条 REMOVED
- [x] 5.2 AGENTS.md：改写成「方向是唯一切换器」，并记下判据出处（决策 10 + 一个动作一个入口）
- [x] 5.3 路线图：步骤 14 补一段

## 6. 五道门

- [x] 6.1 `bun run lint`
- [x] 6.2 `bun run typecheck`
- [x] 6.3 `bun run test`
- [x] 6.4 `bun run build`
- [x] 6.5 `bun run test:e2e`（152 全绿；`app/` 一行未改，它从来没设过 `marqueeMode`）

## 7. 一处观察到但未处理的

- [ ] 7.1 `page-workspace.test.tsx` 的「重复打开同一页面激活既有标签」在一次全量跑里红过一次，
      单跑与随后两次全量跑都绿。与本刀无关（它不碰框选），记在这里免得下次有人以为是本刀带的
