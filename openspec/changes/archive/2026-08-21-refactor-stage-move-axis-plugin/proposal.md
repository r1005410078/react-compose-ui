# 变更：把轴向移动手柄拆成插件，并让会话自报是否接管 Space

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 的 `move-axis`(900)，接在
`refactor-stage-move-planning` 打好的纯函数地基上。

这一刀带出一个**必须先解决的契约缺口**。内核这样分派临时平移键：

```ts
if (event.type === 'temporary-pan.start') {
  if (gesture?.type === 'move') { arbiter.update(event, pluginContext); return }
  if (!snapshot.temporaryPan) publish({ ...snapshot, temporaryPan: true })
}
```

它认的是 **legacy 的 `gesture`**。移动进插件后 `gesture` 是 null，按 Space 会掉进 else 分支
去切临时平移标志，而不是锁定原父级。已用临时改动验证：去掉修复后 9 条用例里有 2 条当场失败。

后果正是 AGENTS.md 点名要防的那类——动画模式下拖拽失去父级锁定，对象会被静默挂进激活场景、
打点串进别块场景的动画。

## 变更内容

- `StageSession` 新增 `consumesTemporaryPan?: boolean`，`StageSessionArbiter` 新增
  `activeSessionConsumesTemporaryPan()`。判据由**会话自报**，不是让内核按插件 id 列表判断——
  后者会把手势知识重新塞回内核，而且每新增一个移动入口就要改内核一次。
- 新增 `move-plugin.ts`：`createStageMoveSession`（共享会话）、`claimStageMove`（共享接管收尾）
  与 `createStageMoveAxisPlugin`（900 入口）。移动与 marquee 一样有多个入口，`entity-select-move`
  (700) 落地时复用同一个工厂。
- 会话把最近一次指针位置存为**屏幕**坐标：Space 切换时要用同一个入口原地重算，而世界坐标依赖
  手势冻结的 viewport，存屏幕点才能原样复算。
- 命中手柄但工具已不是 move、或选区没有可移动目标时返回 `consumed`——手柄画在选区之上，放行会
  让这次按下退化成一次自由拖动。

## 影响

- 受影响的规范：`stage-engine`（Stage 交互插件仲裁、画布拖拽 reparent 会话）
- 受影响的代码：`interaction-kernel/move-plugin.ts`（新增）、`interaction-kernel/kernel-types.ts`、
  `interaction-kernel/session-arbiter.ts`、`interaction-kernel/extracted-plugins.ts`、
  `interaction-kernel/index.ts`、`interaction-controller.ts`
