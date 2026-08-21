# 变更：动画模式画布拖拽锁定原父级

## 原因

动画模式下的画布拖拽仍会走设计模式的结构落点判定：拖动某块场景内的对象时，一旦落点被判
到场景之外（或另一块场景），手势会提交一次跨场景 reparent（事务日志可见
`Move Rectangle to 场景`），对象被静默挂进激活场景。此后动画作用域跟随对象走，用户在
场景 B 的打点全部落进场景 A 的动画、场景 B 的动画保持为空——违反「动画模式 MUST 以当前
作用域 Frame 为界」的既有需求。动画模式里拖拽表达的是**姿态编辑**（自动记录开启时写
关键帧、关闭时写基础 offset），不应产生结构变更。

## 变更内容

- `stage-engine`：`StageInteractionContext` 新增可选 `lockGestureParent` 输入；为 true 时
  move 手势按「锁定原父级」运行（与手势中按住 Space 同一语义与代码路径）：不产生跨父级
  reparent 落点与命令，同容器重排照常。
- `stage`：`ComposeStage` 新增可选 `lockGestureParent` prop，原样传入交互 Controller 的
  context。
- `editor`：动画模式分支向 Stage 传 `lockGestureParent: true`，使动画模式下的拖拽只能是
  姿态编辑；落点高亮随之消失（dropTarget 为 null），不再出现误导性的挂载指示。
- 回归 E2E：动画模式下在第二块场景拖动对象 → 对象仍属该场景且按播放头写入关键帧，
  另一块场景的动画不受影响。

## 影响

- 受影响的规范：`stage-engine`（画布拖拽 reparent 会话）、`stage`（新增手势父级锁定
  输入）、`editor-workspace-layout`（动画模式）
- 受影响的代码：
  - `packages/stage-engine/src/interaction-controller.ts`（context 字段 + dropTarget 判定）
  - `packages/stage/src/types.ts`、`packages/stage/src/stage-surface/compose-stage.tsx`
    （prop 透传）
  - `packages/editor/src/compose-editor/compose-editor.tsx`（动画模式分支传入）
  - `e2e/scene-animation.spec.ts`（回归用例）
