# 任务：补上插件抽取过程中失效的两道守卫

- [x] 1.1 临时用例复现旋转丢失并发中止（`expected 'rotate' to be 'idle'`），确认后删除
- [x] 1.2 新增 `spatial-baseline.ts`，rotate 接入；paint-sample 写明刻意不接的理由
- [x] 1.3 补两条 rotate 回归用例：并发文档变化、并发布局 revision 前进
- [x] 2.1 新增 `extracted-plugins.ts`，controller 与顺序不变量测试共用同一份登记
- [x] 2.2 补断言：已登记插件必须在优先级表中存在且优先级一致
- [x] 3.1 归档四个已合入的 Stage 插件抽取变更，使 MODIFIED delta 可引用基线要求
- [x] 3.2 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
