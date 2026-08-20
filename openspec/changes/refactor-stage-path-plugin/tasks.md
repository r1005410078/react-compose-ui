# 任务：把可编辑路径手柄拖拽拆成交互插件

- [x] 1.1 新增 path 插件；三阶段与中断载荷集中拼装
- [x] 1.2 `cancel(ctx)` 承接 `reset()` 的路径中断通知
- [x] 1.3 `isCompatibleWith` = 编辑目标未换 + 空间基线成立
- [x] 1.4 legacy 删除 claim / update / finish / 联合变体 / reset 分支 / 并发中止分支
- [x] 2.1 补 path-plugin 测试：优先级、并发文档、并发布局、中断坐标、换目标
- [x] 2.2 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
