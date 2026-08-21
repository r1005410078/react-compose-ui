# 任务：把渐变控制柄拖拽拆成交互插件

- [x] 1.1 新增 `paint-geometry.ts`；`paintAtLocalPoint` 改名 `paintSpacePoint` 迁出
- [x] 1.2 `paint-sample` 改用共享换算，删除内联的同段逆矩阵计算
- [x] 1.3 新增 paint 插件；接管条件不成立时 `consumed`
- [x] 1.4 `isCompatibleWith` = 空间基线 + paintEditing 目标 + 单选
- [x] 1.5 legacy 删除 claim / update / finish / 联合变体 / 并发中止分支与两个私有 helper
- [x] 2.1 补 paint-plugin 测试：优先级、并发文档、关编辑、改选区、锁定消费、取消
- [x] 2.2 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
