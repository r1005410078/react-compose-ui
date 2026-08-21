# 任务：把缩放手柄拆成交互插件

- [x] 1.1 新增 resize 插件，等比约束语义原样保留
- [x] 1.2 接管条件不成立时 `consumed`
- [x] 1.3 legacy 删除 `startResize`、Gesture 变体、update / finish 分支
- [x] 1.4 并发中止退化成上下文三项恒等，删除 `gestureIds` 与 `sameIds`
- [x] 2.1 补 7 条测试：优先级、预览与提交、工具不对、无目标、并发、取消、等比
- [x] 2.2 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
