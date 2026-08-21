# 任务：把图形绘制拆成交互插件

- [x] 1.1 新增 `drawing-tools.ts`，三个绘制几何函数迁出 controller
- [x] 1.2 新增 draw 插件并登记；会话刻意不接空间基线，只比 tool
- [x] 1.3 legacy 去掉 `spatialGesture` 分类——例外跟着绘制一起搬走了
- [x] 1.4 修复 `marquee-plugin.test.ts` 的 `hit` 类型（main 上的 typecheck 失败）
- [x] 1.5 清掉 marquee 抽取在 `begin()` 里留下的缩进残迹
- [x] 2.1 补测试：优先级、压节点起笔、并发文档不中止、工具切换中止、零尺寸、文字、取消
- [x] 2.2 lint、typecheck、test、build、e2e 全绿；`interaction-controller.test.ts` 一行未改
