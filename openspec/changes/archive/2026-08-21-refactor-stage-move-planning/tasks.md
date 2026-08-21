# 任务：把移动预览与提交规划抽成纯函数

- [x] 1.1 新增 `move-planning.ts`：`planMovePreview`
- [x] 1.2 `resolveCommittableDropTarget` 由私有闭包改为接收 document 的纯函数
- [x] 1.3 `planMoveCommit` 合并 `finish` 里两条 move 分支
- [x] 1.4 激活阈值改为具名常量并写明按屏幕像素判定
- [x] 1.5 controller 卸掉七个不再使用的导入
- [x] 2.1 补 11 条纯函数测试：激活阈值、zoom、轴向、锁父级、落点复核、提交规划
- [x] 2.2 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
