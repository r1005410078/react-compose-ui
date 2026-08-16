## 1. stage-engine 会话、命中与手势

- [x] 1.1 Red：顶点命中优先于 Entity、切线命中优先于顶点、未注入路径时行为不变的
  `interaction-controller.test.ts` 用例。
- [x] 1.2 Green：新增 `StagePathEditing`、`StageEditablePath`、`StagePathHandleKind`，
  给 `StageInteractionHit` 增加 `path-handle` 分支，给 `StageInteractionContext`
  增加 `pathEditing`，并在命中排序中插入路径手柄。
- [x] 1.3 Red：一次拖拽产生开始/移动/结束三阶段且带修饰键、拖拽期间不产出 Patch 的用例。
- [x] 1.4 Green：按 `paint-handle` 现有分支实现路径手柄的手势阶段。
- [x] 1.5 从 `packages/stage-engine/src/index.ts` 导出新公共类型，补 TSDoc。

## 2. stage Overlay 与 props

- [x] 2.1 Red：轨迹与等时采样点渲染、切线手柄显示条件、未传路径时不渲染的组件测试。
- [x] 2.2 Green：`StageOverlayProps` 增加 `editablePath`，实现虚线轨迹、等时采样点、
  切线连杆与手柄、顶点菱形；渲染顺序在选区框之下、吸附参考线之上；
  命中区独立放大，沿用 `LINE_ENDPOINT_HIT_RADIUS` 的做法。
- [x] 2.3 Green：`ComposeStageProps` 增加 `editablePath`、`onEditablePathChange`
  与 `onEditablePathVertexToggle`，接线到引擎上下文与命中回调。
- [x] 2.4 顶点菱形与时间线关键帧菱形使用同一形状与主题 token。

## 3. editor 接线

- [x] 3.1 Red：`motion-path-adapter` 纯函数测试——位置轨道 → `StageEditablePath`，
  以及手势结果 → 命令的翻译（顶点 → 关键帧写入、切线 → 空间切线、双击 → 模式切换）。
- [x] 3.2 Green：实现 `packages/editor/src/animation-mode/motion-path-adapter.ts`，
  用 `@compose-ui/animation` 的 `sampleComposeMotionPath` 求几何。
- [x] 3.3 Green：`move` 阶段只更新本地预览几何，`end` 阶段派发带 `meta.mergeKey` 的命令，
  保证一次拖拽在撤销栈里只有一条记录。
- [x] 3.4 Green：Shift 约束 smooth 顶点两侧切线共线等长；切到 corner 时清零两侧切线。
- [x] 3.5 只在动画模式且选中 Entity 有位置轨道时传入路径；退出动画模式立即清除。

## 4. 验证

- [x] 4.1 `bun run --filter @compose-ui/stage-engine test`、
  `bun run --filter @compose-ui/stage test`、`bun run --filter @compose-ui/editor test`。
- [x] 4.2 仓库根 `bun run lint && bun run typecheck && bun run test && bun run build`。
  typecheck/build 全绿；lint 与 test 仅剩 add-animation-mode-binding 任务 7.2 已记录的
  既有失败（compose-editor react-hooks/refs 一条、只读页面 JSON 标签两例），与本变更无关。
- [x] 4.3 `bun run test:e2e`：拖顶点后关键帧值变化、拖切线后轨迹弯曲、双击切换顶点模式、
  退出动画模式后覆盖层消失、一次拖拽只产生一条撤销记录。该用例抓出并修复三个缺陷：
  value 草稿命令缺 `timeMs` 被 keyframe.set 拒绝（已补真实 runtime 契约回归测试）；
  路径层被 nw 缩放手柄压住（顶点与对象角点必然重合，已调层并修订规范措辞）；
  双击切换用 `>=2` 判定会因连击计数从上次拖拽延续而切换两次（改为恰好等于 2）。
- [x] 4.4 `openspec validate add-stage-motion-path --strict`。
