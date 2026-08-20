# 任务：把图层取色拆成交互插件

- [x] 1.1 新增 paint-sample 插件；`samplePaintAt` 改为接收 document/index 显式参数
- [x] 1.2 会话实现 `isCompatibleWith`：采样目标变化即结束
- [x] 1.3 legacy 删除 claim / update / finish / 联合变体 / 并发中止分支 / 两个 helper
- [x] 2.1 `interaction-controller.ts` 2500 → 2385 行（净减 115）
- [x] 2.2 lint、typecheck 46/46、test 45/45（stage-engine 235）、build 24/24、e2e 99/99
- [x] 2.3 `interaction-controller.test.ts` 一行未改；既有取色测试全绿即为无行为变化证据
