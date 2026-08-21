# 任务：Auto Layout 拖拽语义对齐 Figma 与手势期实时布局

实施顺序说明：第 1、2 节是无行为变更的性能前置，可先独立验证收益；第 3 节翻转 core 默认值，
第 4~6 节依赖第 3 节；第 7 节实时布局依赖第 1、2 节。

## 1. layout-engine 增量重解（无行为变更）

- [x] 1.1 Red：单节点变更时引用未变 Entity 不重写样式、不重调 measurement port（spy 断言）
  - Red：`bun run --filter @compose-ui/layout-engine test`；3 failed / 14 passed。
- [x] 1.2 Green：`prepareTree`/`applyEntityStyle` 按「自身引用未变且父级 Layout 未变」跳过
- [x] 1.3 Red→Green：measurement 结果按（Renderer 引用，约束）缓存；port revision 失效仍走
      `invalidateMeasurements`
  - 缓存键从提案的「Entity 引用」改为「Renderer 引用 + 约束」：拖拽只替换 LayoutItem，
    Entity 引用必变；adapter 契约要求只测量隔离内容，测量输入不含 LayoutItem。
  - 首版测试用 margin 变化验证命中，实测 margin 会改变 Yoga 可用空间约束、理应重测；
    改用 Absolute hug leaf 的 offset 变化（约束逐位相同的最高频路径）。
- [x] 1.4 Red→Green：`calculateAndPublish` 对值未变 box 复用上一 Snapshot 对象
  - Green：`bun run --filter @compose-ui/layout-engine test`；17 passed。
- [x] 1.5 基准复测：单节点变更 per-solve：500 Entity 4.83→0.90ms，1000 Entity 9.46→1.78ms，
      2000 Entity 19.63→3.62ms（M 系列 mac / bun / 嵌套 wrap 容器每层 8 子级）

## 2. layout-engine 预览通道

- [x] 2.1 Red：`previewDocument`/`clearPreview` 的状态机（预览标记、正式提交隐式清除）
  - Red：2 failed（接口不存在）；Green：`bun run --filter @compose-ui/layout-engine test`
    19 passed。
- [x] 2.2 Green：实现预览求解，复用同一棵 Yoga 树（增量样式缓存让预览↔提交切换只重写
      变更 Entity）
- [x] 2.3 TSDoc 与公共入口导出（接口方法挂在 `ComposeLayoutRuntime` 上，入口无新增符号；
      ready 状态新增 `preview` 标记字段）

## 3. core 显式脱流意图

- [x] 3.1 Red：无 `detachFromFlow` 的 move 不改 positioning/axis mode；带意图时原子烘焙且
      inverse 完整
  - Red：`bun run --filter @compose-ui/core test`；1 failed（首版夹具缺 Layout 父级被
    validator 拒绝，补父级后仍 Red）。
- [x] 3.2 Green：`appendSpatialTransformPatches` 改由意图字段驱动，handler 校验
      `detachFromFlow` 必须为 boolean；Green：133 passed
- [x] 3.3 清点仓库内既有 `setTransform` move 调用方：
  - `interaction-controller.ts` 手势提交（第 4 节改）
  - `compose-stage.tsx` 方向键 nudge——原行为是隐式脱流，改为过滤 Flow 目标（位置由
    布局决定，平移无可见效果，避免空事务）
  - `editor/controller.tsx`（resize 实例路径）、`animation-mode/auto-record.ts`（draft
    采集）不依赖隐式烘焙；`ruler-painter.ts` 是 canvas API 同名方法

## 4. stage-engine 落点判定与提交

- [x] 4.1 Red：`resolveStageDropTarget` 新增 `modifiers` 入参；Alt 绕过深入判定；Space 锁定
      原父级（改为返回 null + 提交分支过滤 Flow，见 design.md §5 更新；不引入 `none` 落点）
  - Red：`bun run --filter @compose-ui/stage-engine test`；5 failed / 143 passed。
- [x] 4.2 Red：wrap 行聚类 + 行内主轴命中（含 `wrap-reverse` 行序取反、`row-reverse` 主轴取反）
  - 实现中发现：指针在目标行交叉轴区间外侧时必须按「换行方向」判定整行前/后，
    否则拖出行外会误插行首；该判定只对 wrap 生效，nowrap 保持纯主轴比较。
- [x] 4.3 Green：drop-target 实现；Space 锁定支持在锁定父级内继续重排
- [x] 4.4 Red→Green：`resolveStageDropIndicator` 支持行定位插入线（wrap 只覆盖目标行交叉轴
      区间，nowrap 保持整容器跨度）
- [x] 4.5 Red→Green：interaction-controller 提交分支——move 手势在 setTransform 分支过滤
      Flow 目标（回弹零事务）；Absolute/顶层目标行为不变；三个编码旧「隐式脱流」行为的
      测试改写为新语义
- [x] 4.6 Red→Green：手势中 Space 复用 `temporary-pan.start/end` 事件表达父级锁定，不进入
      临时平移；预览 Snapshot 不喂给 controller context（见 design.md §6.4 更新），
      外部并发变化的中止规则不变
  - Green：`bun run --filter @compose-ui/stage-engine test`；150 passed。

## 5. materials 忽略 Auto Layout 开关

- [x] 5.1 Red：开关只在父级为 Layout 容器时出现；脱流烘焙 offset/fixed；回流走采纳规则
  - Red：`bun run --filter @compose-ui/materials test`；2 failed / 91 passed。
  - 单条 `updateComponent` 事务天然可一次 undo；开关渲染为 checkbox（Property Panel 的
    boolean 标准行）。
- [x] 5.2 Green：几何 Inspector 以 schema 字段 `ignoreLayout` 实现开关，基线复用当前值使其
      不参与重置；Green：93 passed

## 6. stage 落点指示渲染

- [x] 6.1 wrap 插入线渲染：Stage Overlay 只消费 engine 的 start/end 几何，行定位随 4.4 的
      indicator 扩展免费获得，无需新增渲染代码或 token
- [x] 6.2 黄金图更新并入第 8 节 e2e 运行

## 7. editor/stage 实时布局接线

- [x] 7.1 `ComposeStageLayoutRuntime` 扩展可选 `previewDocument`/`clearPreview`；
      ComposeStage 在 resize 手势期间以 rAF 合并把预览文档（Flow 目标两轴强制 fixed，
      见 `resize-preview.ts`）喂给 Runtime；新增 `layoutPreviewSnapshot` prop 只进场景
      渲染层，controller context 保持提交态 Snapshot
- [x] 7.2 editor `useComposeEditorLayout` 拆分提交态 state 与 previewSnapshot（渲染期幂等
      ref 缓存最后提交态）；`resize-preview.test.ts` 覆盖求解文档构造；取消手势时
      resizeSolveDocument 变 null → `clearPreview` 恢复提交态渲染，全程零事务
  - 全仓 `bun run test`：45 tasks successful；`bun run typecheck` 通过。

## 8. E2E 与验证

- [x] 8.1 更新依赖「拖拽即脱流」的用例：`auto-layout.spec.ts` 的 nudge 脱流流程改为
      「nudge no-op + 忽略自动布局开关脱流」；受开关新增行影响的 5 张黄金图逐张核对后
      重新生成（basic-inspector-{flow-fill,absolute-fixed,size-suggestions,margin-expanded}、
      auto-layout-fill-interactions）
- [x] 8.2 新增 e2e（`stage-text-and-dnd.spec.ts`）：拖出容器回弹零事务、Alt 强制吸入贴边
      容器、Space 锁父级、resize 实时让位（含 Escape 恢复提交态）、wrap 跨行重排
  - wrap 用例实测发现 Rectangle 默认 240 宽，648 容器开 wrap 天然 2+1 两行，无需收窄；
    首版按 100 宽假设收窄到 260 会退化为每行一个。
- [x] 8.3 运行 lint、typecheck、test、build、test:e2e
  - lint ✓；typecheck ✓（materials 的条件 schema 展开需显式标注 `v.ObjectEntries`）；
    test 45 tasks ✓；build ✓；test:e2e 74 passed ✓
- [x] 8.4 `openspec validate update-auto-layout-drag-semantics --strict` 通过
- [x] 8.5 README Inspector 基础区描述补充「忽略自动布局」开关与新拖拽语义
      （重排/Alt/Space/实时让位）
