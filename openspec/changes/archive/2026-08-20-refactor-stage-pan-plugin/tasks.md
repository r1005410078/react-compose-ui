# 任务：把 pan 手势拆成第一个真实交互插件

**验收铁律**：`interaction-controller.test.ts`（2225 行）与全部 e2e **一行不改**仍然全绿。
允许新增测试，不允许修改既有断言。

**完成判据（本步特有）**：`Gesture` 联合不再有 `pan` 变体，`begin`/`updateGesture` 不再有
pan 分支，`interaction-controller.ts` 行数**净减少**。只加插件不删 legacy 分支不算完成——
那会让行为隐式依赖优先级顺序，写错时静默回退而非可见失败。

## 1. 契约扩展（纯新增，先于插件）

- [x] 1.1 `StagePluginContext` 增加只读 `snapshot`（取值器实时读取，不得快照式捕获）
      与 `idleSnapshot()`（保留 `temporaryPan` 的空闲快照工厂）
- [x] 1.2 `StageSessionArbiter` 增加 `activePluginId(): string | null`
- [x] 1.3 内核单测：`activePluginId` 在接管与取消后的取值、未接管时为空

## 2. pan 插件

- [x] 2.1 新增 `interaction-kernel/pan-plugin.ts`：claim 判定三种入口
      （`tool === 'pan'`、`snapshot.temporaryPan`、中键），会话 update 发 `viewport.change`，
      commit 为纯清理（发布空闲快照后释放指针捕获，顺序对照 `finish()` 尾部）
- [x] 2.2 在 controller 中按 `STAGE_GESTURE_PRIORITY` 的 1700 注册，排在 legacy 之前
- [x] 2.3 插件纯状态机单测 15 例：三种入口、不接管时零副作用、位移以按下时视口为基线
      （第二帧不在第一帧结果上累加）、忽略非平移事件、结束无命令、优先级取自表

## 3. legacy 瘦身

- [x] 3.1 删除 `begin()` 的 `startPan` 分支
- [x] 3.2 删除 `updateGesture()` 的 `gesture.type === 'pan'` 分支
- [x] 3.3 删除 `Gesture` 联合的 `pan` 变体
- [x] 3.4 `send` 的 `temporary-pan.end` 改用 `arbiter.activePluginId() === 'pan'`；
      `temporary-pan.start` 的 `gesture?.type === 'move'` 保持不动（等 move 迁移时一并改）

## 4. 验证

- [x] 4.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 4.2 `bun run test:e2e`：重点核对临时平移（Space）、中键平移、pan 工具三条路径
- [x] 4.3 `interaction-controller.ts` 2922 → 2890 行，净减 32（claim 分支 15、update 分支 11、
      `Gesture` 联合的 pan 变体 6）
- [x] 4.4 `docs/stage-plugin-kernel-roadmap.md` 标记步骤 3 的第一个手势完成

## 5. 实施记录

- [x] 5.1 内核测试 37 例（原 22 + 新增 15）；`interaction-controller.test.ts` 2225 行一行未改
- [x] 5.2 pan 插件的伪 context 把 `index` 写成抛错取值器，用类型之外的方式钉死
      「平移不读场景索引」这条设计约束——真读了会在测试里当场炸掉
- [x] 5.3 验证：lint、typecheck 46/46、test 45/45（stage-engine 198）、build 24/24、
      e2e 99/99 黄金图零差异
