# 变更：画布可编辑运动路径

## 原因

动画模式接通后，位置动画只能在时间线上以关键帧的形式编辑，用户看不到对象实际走的轨迹，
也无法直接调整轨迹形状。Rive 在 stage 上画只读运动路径，After Effects 允许直接编辑路径顶点与
空间切线。本变更交付可编辑的那一档：关键帧即顶点，拖顶点改值，拖切线改路径弯曲。

## 变更内容

- `stage-engine` 新增通用的可编辑路径会话与命中语义：`StagePathEditing`、`StageEditablePath`、
  `StagePathHandleKind`，以及 `StageInteractionHit` 的 `path-handle` 分支与对应手势阶段。
  引擎只处理几何与手势，不认识关键帧。
- `stage` 的 Overlay 新增可编辑路径层：虚线轨迹、体现速度的等时采样点、切线连杆与手柄、
  顶点菱形。`ComposeStage` 新增 `editablePath` 与手势回调，Stage MUST NOT 自行派发命令。
- `editor` 的动画模式把位置轨道通过 `@compose-ui/animation` 的 `sampleComposeMotionPath`
  转成 `StageEditablePath`，并把手势结果翻译成关键帧与空间切线命令。

## 影响

- 受影响规范：`stage`、`stage-engine`
- 受影响代码：`packages/stage-engine/src/interaction-controller.ts`、
  `packages/stage/src/types.ts`、`packages/stage/src/stage-overlay.tsx`、
  `packages/stage/src/stage-surface/compose-stage.tsx`、
  `packages/editor/src/animation-mode/motion-path-adapter.ts`（新增）
- 依赖 `add-scene-animation-model` 与 `add-animation-mode-binding` 先落地
