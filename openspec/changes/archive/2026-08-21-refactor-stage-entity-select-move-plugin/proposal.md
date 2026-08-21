# 变更：把实体选中并拖动拆成交互插件

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 的 `entity-select-move`(700)，
画布上最常走的一条路径。

它是移动手势的第二个入口，`refactor-stage-move-axis-plugin` 已经把 `createStageMoveSession`
与 `claimStageMove` 建好，因此这一刀同样只需搬**接管条件**——但这个入口的接管条件本身是一棵
决策树：先改选区，再按工具与目标状态决定这次按下变成原地文字编辑、移动手势，还是仅仅改选区。

## 变更内容

- `move-plugin.ts` 新增 `createStageEntitySelectMovePlugin`（700 入口），与 900 共用同一个
  会话工厂。
- 无论是否开始移动，这次按下一律 `consumed`：选区已经改过了，再交给后续插件会让同一次按下
  既改选区又起框。
- **随之删除 legacy 里整套失效的移动机制**。`startTransform('move', …)` 至此再无调用者，因此
  `Gesture` 的 move 变体、`updateGesture` 的 move 分支、`finish` 的 move 分支、legacy 会话里
  move 专属的 Space 处理、并发中止判定里的 move 分支全部成为死代码，一并移除。
  `startTransform` 收窄成只服务缩放的 `startResize`，内核的 temporary-pan 分派也不必再问
  legacy 的 `gesture`，只问会话的 `consumesTemporaryPan`。

## 一处被这一刀暴露的既有缺口

e2e 的「节点层级操作」用例失败：右键不再弹出上下文菜单。

根因不在本次新增的代码，而在**抽取模型本身**：`event.button > 1` 原本是 legacy `begin()`
顶部的一道总闸，而插件排在 legacy **之前**被询问，从第一个插件落地起就绕过了它。此前没暴露，
只是因为已抽取插件接管的命中类型恰好没有被右键点过——`entity` 是第一个。

修法是把这条判定放回**唯一正确的位置**：controller 询问插件之前。放进各插件既会漏，也让每个
新插件都要重复它；放进仲裁器则等于让内核认识鼠标按键语义。

## 影响

- 受影响的规范：`stage-engine`（ECS SceneIndex 的实体选中语义）
- 受影响的代码：`interaction-kernel/move-plugin.ts`、`interaction-kernel/extracted-plugins.ts`、
  `interaction-kernel/index.ts`、`interaction-controller.ts`
