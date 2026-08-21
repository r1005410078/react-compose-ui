# 任务：把框选工具入口拆成交互插件，并建立共享框选会话

- [x] 1.1 `marqueeDirection` / `marqueeCombine` / `resolveMarqueeCommit` 进 `marquee-selection.ts`
- [x] 1.2 `rectFromPoints` 从 controller 私有函数提升为 `geometry.ts` 公开函数
- [x] 1.3 新增 `createStageMarqueeSession` 与 `claimStageMarquee` 共享工厂
- [x] 1.4 新增 1100 入口插件；legacy 只删这一个 claim 分支
- [x] 1.5 legacy 的 finish 改调 `resolveMarqueeCommit`，避免两份提交实现
- [x] 2.1 补测试：优先级、压节点起框、一次选区变更、松手修饰键、并发文档、取消、非本工具
- [x] 2.2 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
