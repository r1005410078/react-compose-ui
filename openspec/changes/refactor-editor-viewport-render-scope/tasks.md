## 1. Stage 场景内容与视口解耦（已交付）

- [x] 1.1 Red: 断言纯 viewport 更新不重渲 Entity 渲染器、不遍历全部 Entity 计算内容边界；
  记录失败证据（`a: 4` vs `a: 2`；枚举次数 `4` vs `2`）。
- [x] 1.2 Green: StageSceneLayer 内容子树与 viewport 解耦，pointer 回调经 ref 转发；
  `bootstrapContentBounds` 改为惰性求值。
- [x] 1.3 Refactor: 补 changeset 与实现注释；1500 Entity 实测 p50 16.1ms → 8.3ms。
  已随提交 `efb36bb` 作为非破坏性性能修复交付，本提案只补齐对应规范。

## 2. viewport 会话状态订阅化

- [x] 2.1 Red: 为「纯 viewport 更新不重渲无关面板」写 controller 测试，断言 Registry Inspector
  渲染次数与 `sceneTreeProps` 引用不变；记录失败证据（Inspector 渲染次数 `19` vs `18`）。
- [x] 2.2 Green: 在 controller 内实现 viewport store 与 `useComposeStageViewport`，Stage 与
  工具栏改为订阅。
- [x] 2.3 Refactor: `setViewport` 保留 updater 形式，受控 Stage 契约与既有 105 个 controller
  测试全绿。

## 3. chrome 记忆化边界（实测后载去）

- [x] 3.1 实测结论：viewport 订阅化之后，1500 Entity 完整编辑器平移 p50 8.3ms、p95 10.2ms、
  0 帧超过 20ms，平移路径上 chrome 已经完全不参与渲染，memo 边界没有可测收益。
- [x] 3.2 另外验证了两条高频路径：单击选中 max 24.9ms 无 longtask；拖动 Entity 每帧
  p50 8.3ms、p95 10ms，仅在手势结束提交时有一次 66ms longtask——那是 1500 Entity 文档的
  事务提交与布局重解，memo 边界同样无法消除。
- [x] 3.3 因此不引入投机性 memo 边界。选择变化时场景树与 Inspector 的 props 确实变化，
  记忆化本就无法 bail out。若将来有实测证据再单开变更。

## 4. 文档与回归

- [x] 4.1 更新 README 与 package TSDoc 中受影响的说明。
- [x] 4.2 添加 changeset，标注 `controller.viewport` 重渲语义变化。
- [x] 4.3 运行 `openspec validate --strict`、lint、typecheck、test、build、test:e2e。
- [x] 4.4 复测 1500 Entity 平移帧间隔：完整编辑器 p50 16.1ms → 8.3ms，p95 24.3ms → 10.2ms。
