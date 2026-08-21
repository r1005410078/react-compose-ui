# 任务：把两点图形端点拖拽拆成交互插件

- [x] 1.1 新增 segment-resize 插件；吸附候选改为直接调用 `resolveTargetFrameId`
- [x] 1.2 `grabOffset` 在 claim 时算好并冻结，语义原样保留
- [x] 1.3 接管条件不成立时 `consumed`
- [x] 1.4 `isCompatibleWith` = 空间基线 + 顶层选区恰好是该 Entity
- [x] 1.5 legacy 删除 claim / update / finish / 联合变体 / 并发中止分支
- [x] 2.1 补测试：优先级、抓取偏移、一次提交、并发文档、改选区、锁定消费
- [x] 2.2 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
