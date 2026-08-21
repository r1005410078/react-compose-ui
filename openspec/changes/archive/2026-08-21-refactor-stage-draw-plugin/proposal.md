# 变更：把图形绘制拆成交互插件

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 按优先级自上而下的第九刀
（`draw`，1000）。

它是内核里**唯一一个不该被并发文档变化打断**的手势，这条例外此前写死在 controller 的
`spatialGesture = gesture.type !== 'draw'` 上。绘制搬进插件后，legacy 里只剩引用 Entity 的
空间手势，这个按手势种类分类的判定随之整体消失——例外跟着它的手势一起走，正是插件化要达到的
效果。

顺带修掉两处已合入的问题：`marquee-plugin.test.ts` 的 `hit: Record<string, unknown>` 让
`bun run typecheck` 在 main 上失败（上一刀的最终门槛遗漏了 typecheck），以及 marquee 抽取时在
`begin()` 里留下的一处缩进残迹。

## 变更内容

- 新增 `draw-plugin.ts`，优先级 1000 取自 `STAGE_GESTURE_PRIORITY`，登记进
  `STAGE_EXTRACTED_PLUGIN_FACTORIES`。
- 新增 `drawing-tools.ts`：`isDrawingTool`、`constrainedDrawingPoints` 与私有的
  `constrainSquareDrawingPoints` 迁出 controller。`isDrawingTool` 光标派生仍要用，因此放在共享
  模块而不是插件内部——插件导入 controller 的值会构成运行时循环。
- 会话**刻意**不接 `captureStageSpatialBaseline`，只比 `tool`：绘制只由世界坐标定义，不引用
  任何 Entity；工具切换仍然中止。
- legacy 的 `incompatible` 去掉 `spatialGesture` 分类，直接按文档 / 布局 revision / 工具判定。
- 修复 `marquee-plugin.test.ts` 的 `hit` 类型与 `begin()` 中的缩进残迹。

## 影响

- 受影响的规范：`stage-engine`（Headless 绘制会话）
- 受影响的代码：`interaction-kernel/draw-plugin.ts`（新增）、`drawing-tools.ts`（新增）、
  `interaction-kernel/extracted-plugins.ts`、`interaction-kernel/index.ts`、
  `interaction-kernel/marquee-plugin.test.ts`、`interaction-controller.ts`
