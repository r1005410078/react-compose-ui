## 1. Stage 场景内容与视口解耦（已交付）

- [x] 1.1 Red: 断言纯 viewport 更新不重渲 Entity 渲染器、不遍历全部 Entity 计算内容边界；
  记录失败证据（`a: 4` vs `a: 2`；枚举次数 `4` vs `2`）。
- [x] 1.2 Green: StageSceneLayer 内容子树与 viewport 解耦，pointer 回调经 ref 转发；
  `bootstrapContentBounds` 改为惰性求值。
- [x] 1.3 Refactor: 补 changeset 与实现注释；1500 Entity 实测 p50 16.1ms → 8.3ms。
  已随提交 `efb36bb` 作为非破坏性性能修复交付，本提案只补齐对应规范。

## 2. viewport 会话状态订阅化

- [ ] 2.1 Red: 为「纯 viewport 更新不重渲无关面板」写 controller 测试，断言场景树行渲染计数
  与 Inspector 渲染计数不变；记录失败证据。
- [ ] 2.2 Green: 在 controller 内实现 viewport store 与订阅入口，Stage 与工具栏改为订阅。
- [ ] 2.3 Refactor: 保持 `setViewport` 与受控 Stage 契约不变，既有 controller 测试全绿。

## 3. chrome 记忆化边界

- [ ] 3.1 Red: 断言 controller 重渲时 ComposeSceneTree 在 props 未变的情况下不重渲。
- [ ] 3.2 Green: 为与 viewport 无关的第一方 chrome 组件建立 memo 边界。
- [ ] 3.3 Refactor: 确认没有内联 props 击穿边界，必要时把回调收敛进 controller 的 useMemo。

## 4. 文档与回归

- [ ] 4.1 更新 README、package TSDoc 与 `openspec/project.md` 中受影响的说明。
- [ ] 4.2 添加 changeset，标注 `controller.viewport` 重渲语义变化。
- [ ] 4.3 运行 `openspec validate --strict`、lint、typecheck、test、build、test:e2e。
- [ ] 4.4 复测 1500 Entity 平移帧间隔，记录完整编辑器下的 p50/p95。
