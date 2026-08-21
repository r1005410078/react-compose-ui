# 任务：把轴向移动手柄拆成插件，并让会话自报是否接管 Space

- [x] 1.1 `StageSession.consumesTemporaryPan` 与 `arbiter.activeSessionConsumesTemporaryPan()`
- [x] 1.2 内核的 temporary-pan 分派改问会话，不再只认 legacy 的 `gesture`
- [x] 1.3 新增 `createStageMoveSession` / `claimStageMove` 共享工厂
- [x] 1.4 新增 900 入口插件；接管条件不成立时 `consumed`
- [x] 1.5 会话存屏幕坐标以支持 Space 切换时原地重算
- [x] 2.1 临时去掉 1.2 的修复，确认 9 条用例中 2 条失败——证明缺口真实存在，随后复原
- [x] 2.2 补 9 条测试：优先级、轴向约束、消费、提交、并发中止、Space 三态
- [x] 2.3 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
