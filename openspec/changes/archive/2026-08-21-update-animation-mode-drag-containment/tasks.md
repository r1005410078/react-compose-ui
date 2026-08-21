# 任务：动画模式画布拖拽锁定原父级

## 1. stage-engine

- [x] 1.1 `StageInteractionContext` 新增可选 `lockGestureParent`；move 手势的
      `resolveStageDropTarget` 调用把它并入 space 锁定（`space: gesture.parentLocked ||
      context.lockGestureParent === true`）
- [x] 1.2 单测：context 锁定时拖过其他容器不产生候选落点，Pointer Up 只更新原父级内坐标

## 2. stage

- [x] 2.1 `ComposeStageProps` 新增可选 `lockGestureParent`，随 `updateContext` 透传；补 TSDoc

## 3. editor

- [x] 3.1 动画模式分支向 Stage 传 `lockGestureParent: true`
- [x] 3.2 回归 E2E（scene-animation.spec.ts）：复制对象跨场景 + 动画模式下在场景 2 拖动 →
      对象仍属场景 2、按播放头写入场景 2 动画的关键帧、场景 1 动画不变

## 4. 验证

- [x] 4.1 `bun run lint && bun run typecheck && bun run test && bun run build` 与
      `bun run test:e2e`
