# 任务：抽完最后五个入口并删除 legacy 单体

- [x] 1.1 新增 `guide-plugin.ts`（400 / 300），两个会话补上空间基线
- [x] 1.2 新增 `fallback-plugins.ts`（500 / 200 / 100）
- [x] 1.3 `marquee-fallback` 复用 `claimStageMarquee`，框选三入口收官
- [x] 2.1 删除 `Gesture`、`updateGesture`、`begin`、`finish`、legacy 会话与 claim
- [x] 2.2 `reset()` 换成 `abortActiveSession()`，转调 `arbiter.cancel`
- [x] 2.3 删除 `incompatible` 判定与 `STAGE_LEGACY_MONOLITH_PRIORITY`
- [x] 3.1 不变量从「前缀」升级为「逐项覆盖」，补优先级两两不同的断言
- [x] 3.2 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
