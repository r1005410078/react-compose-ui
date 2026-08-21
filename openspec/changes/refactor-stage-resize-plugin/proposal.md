# 变更：把缩放手柄拆成交互插件

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 的 `resize`(600)，legacy 最后
一个变换会话。抽完之后 `startTransform` / `startResize` 这一族工厂、`Gesture` 的全部变换变体
与并发中止里的选区比对同时消失——legacy 只剩不引用任何 Entity 的 marquee 与两个 guide 手势。

## 变更内容

- 新增 `resize-plugin.ts`，优先级 600 取自 `STAGE_GESTURE_PRIORITY`。
- 只在 select 与 scale 工具下接管；工具不对或选区没有可缩放目标时返回 `consumed`——手柄画在
  选区之上，放行会让这次按下退化成一次移动或框选。
- 等比约束的语义原样保留：选区里只要有一个目标要求 `preserve-aspect`，整个选区就按等比处理，
  等价于用户一直按着 Shift。否则同一次拖拽会让一部分目标变形、另一部分不变形。
- legacy 随之删除 `startResize`、`Gesture` 的 resize 变体、update / finish 分支，以及并发中止
  判定里的 `gestureIds` 与 `sameIds`。判定退化成上下文三项恒等：**所有引用具体 Entity 的手势
  都已插件化，各自用 `isCompatibleWith` 自报是否仍然成立**。

## 影响

- 受影响的规范：`stage-engine`（受约束变换 System）
- 受影响的代码：`interaction-kernel/resize-plugin.ts`（新增）、
  `interaction-kernel/extracted-plugins.ts`、`interaction-kernel/index.ts`、
  `interaction-controller.ts`
