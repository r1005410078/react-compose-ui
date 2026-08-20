# 任务：Stage 注入面聚合为 services 与 policy

**验收铁律**：本变更零行为变化。除调用点的 prop 写法外，任何现有断言需要修改都是搬迁
越界的信号，必须回退该处实现而不是改断言。

## 1. 基线

- [x] 1.1 记录基线：`bun run test` 45/45 全绿
- [x] 1.2 确认动画模式「拖拽锁定原父级」已有 e2e 覆盖
      （`e2e/scene-animation.spec.ts:148` 动画模式拖拽不跨场景挂载），无需补测试

## 2. 协议

- [x] 2.1 `packages/stage/src/types.ts`：定义 `ComposeStageServices` 与 `ComposeStagePolicy`，
      在 `ComposeStageProps` 上新增 `services`/`policy`，并从包公共入口导出
- [x] 2.2 Stage 在参数解构处一次性把聚合对象摊成原有局部名，3000 行函数体的读取点保持原样；
      `useComposeStageMeasurement` 按字段取端口，memo 依赖仍是各端口本身而不是 services 对象
- [x] 2.3 直接迁移到目标形状（未做「两种形状同时可用」的中间态）：design.md 决策三已否决兼容层，
      调用点全在仓库内且 typecheck 即完整迁移清单，临时双形状只会引入一条随后即删的代码路径

## 3. 调用点迁移

- [x] 3.1 `controller.tsx`：`stageServices`/`stagePolicy` 各自记忆化，不随文档编辑重建；
      新增 `renderStage(overrides)` 与公共类型导出
- [x] 3.2 新增 `stage-props-composition.ts`：`composeEditorStageProps` 按字段合并，
      `compose-editor.tsx` 的 Stage `addDefaultElementProps` 删除，改为 `controller.renderStage()`；
      inspector / toolbar / command panel 的 `addDefaultElementProps` 未动
- [x] 3.3 动画模式改为组装 `policy: { lockGestureParent: ... }`，替换条件 spread；
      运动路径相关 prop 保持原样（属步骤 5）
- [x] 3.4 `viewport-bound-panels.tsx`：删除 `...hostProps` 透传与相应注释
- [x] 3.5 `apps/storybook` 用例、stage 与 editor 单测调用点改用聚合形式

## 4. 收口

- [x] 4.1 平铺 prop 已随 2.1 直接删除，无归一代码需要清理
- [x] 4.2 `bun run typecheck` 46/46 零错误

## 5. 验证

- [x] 5.1 `bun run lint && bun run typecheck && bun run test && bun run build` 全绿
- [x] 5.2 `bun run test:e2e` 99/99 通过，黄金图零差异；动画模式拖拽不跨场景挂载用例通过
- [x] 5.3 同步 `README.md`：新增 services/policy 与 `renderStage` 的宿主说明
- [x] 5.4 在 `docs/stage-plugin-kernel-roadmap.md` 标记步骤 1 完成

## 6. 实施中的两处偏离（已在实现内解决）

- [x] 6.1 `services` 含 `clipboard`（复制时会变），因此提案初稿「整个会话内保持引用稳定」
      的 TSDoc 与规范表述不属实。已改为如实描述：Stage MUST 按字段消费，MUST NOT 以对象
      引用作缓存键；规范增量的对应 Scenario 同步拆成「端口按字段消费」与「policy 变化不牵动端口」
- [x] 6.2 `controller.stage` 改由 `useMemo` 直接构造而不是调用 `renderStage()`：
      渲染期调用该 useCallback 会被 React 规则判为渲染期读 ref（lint 报错）
