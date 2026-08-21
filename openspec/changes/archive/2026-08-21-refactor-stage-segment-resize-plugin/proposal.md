# 变更：把两点图形端点拖拽拆成交互插件

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 按优先级自上而下的第七刀
（`segment-resize`，1200）。

它是第一个需要**吸附求解**的会话：端点拖动复用 `snapResizePoint` 的 smart/grid 规则，
候选来自 `index.snapCandidates`，而候选的作用域要按活动 Frame 求解。这条链原本靠 controller
的私有 `targetFrameId` 闭包拿到，插件里改为直接调用 `resolveTargetFrameId`——同一个纯函数，
只是不再经过闭包。接下来的 `move`(700) 与 `resize`(600) 走同一条链，这次先把路探通。

## 变更内容

- 新增 `segment-resize-plugin.ts`，优先级 1200 取自 `STAGE_GESTURE_PRIORITY`，登记进
  `STAGE_EXTRACTED_PLUGIN_FACTORIES`。
- `grabOffset` 语义原样保留：端点命中区大于端点本身，直接用指针位置会让首次移动把端点"吸"
  到指针上；偏移在 claim 时算好并冻结。
- 接管条件（目标存在且可见、顶层选区恰好是它、未锁定、约束允许 resize、工具为 select/scale）
  任一不成立时返回 `consumed` 而非 `null`——端点手柄画在图形自身两端，放行会让这次按下退化
  成一次移动手势。
- `isCompatibleWith` = 空间基线成立 + 顶层选区仍恰好是该 Entity。
- legacy 删除全部 segment 分支：claim、update、finish、`Gesture` 联合变体、并发中止判定分支。

## 影响

- 受影响的规范：`stage-engine`（Headless 两点端点会话）
- 受影响的代码：`interaction-kernel/segment-resize-plugin.ts`（新增）、
  `interaction-kernel/extracted-plugins.ts`、`interaction-kernel/index.ts`、
  `interaction-controller.ts`
