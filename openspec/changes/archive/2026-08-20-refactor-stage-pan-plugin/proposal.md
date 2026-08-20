# 变更：把 pan 手势拆成第一个真实交互插件

## 原因

这是 [Stage 插件化内核重构路线图](../../../docs/stage-plugin-kernel-roadmap.md) **步骤 3**
的第一刀。步骤 2 已经建好内核，但注册表里只有 `legacy-monolith` 一个插件，内部仍走原级联——
**优先级表至今没有真正生效**。这一步让它第一次承担仲裁职责。

选 `pan` 打头是因为它在 12 个手势里耦合最浅，读代码可验证：

- **零文档耦合**：claim 只读 `context.tool`、`context.viewport` 与 `snapshot.temporaryPan`，
  update 只算 `startViewport + (point - startPoint)`，全程不碰 `context.document`，也不碰
  `index`（`interaction-controller.ts:1427-1436`、`:1745-1758`）。
- **没有提交**：`finish()` 里**没有** pan 分支，松手直接落到公共尾部（publish idle +
  释放指针捕获）。因此 `commit` 是一次纯清理，不产生任何命令。
- **单一 claim 点**：不像 marquee 在级联里有三处入口（`marquee-tool`、`marquee-converge`、
  `marquee-fallback`，优先级 1100/800/100，中间还夹着 draw、resize 等分支）。

## 变更内容

- 新增 `pan` 插件，注册优先级 **1700**（取自 `STAGE_GESTURE_PRIORITY`，对应原
  `begin()` 的 `:1745`），排在 `legacy-monolith` 之前。
- 从 legacy 删除对应分支：`begin()` 的 `startPan`、`updateGesture()` 的
  `gesture.type === 'pan'`、`Gesture` 联合的 `pan` 变体。**legacy 行数必须净减少**。
- **BREAKING**（仅内部协议，公共 API 不变）`StagePluginContext` 增加两项，均由 pan 的实际
  需要驱动：
  - `snapshot`：只读当前快照。pan 的 claim 判定 `snapshot.temporaryPan`（按住 Space 时
    任何位置按下都是平移），而快照是内核状态，插件此前拿不到。
  - `idleSnapshot()`：返回保留 `temporaryPan` 的空闲快照。插件需要它作为发布基线，而
    「空闲」的定义必须由内核持有——`temporaryPan` 是跨会话存活的内核状态，让插件自行拼装
    就会各自复制这条规则。
- `StageSessionArbiter` 增加 `activePluginId()`。`send` 在 `temporary-pan.end` 上需要判断
  「当前会话是不是 pan」才决定是否取消（`:2758` 原为 `gesture?.type === 'pan'`）；pan 的
  状态搬进插件后，这个判断不能再读 `gesture`。
- 优先级表首次生效：`pan`(1700) 与 `legacy-monolith`(0) 之间的顺序开始决定行为。

## 影响

- 受影响的规范：`stage-engine`（Stage 交互插件仲裁：追加插件上下文与活动插件查询）
- 受影响的代码：
  - `packages/stage-engine/src/interaction-kernel/kernel-types.ts`（`StagePluginContext` 扩展）
  - `packages/stage-engine/src/interaction-kernel/session-arbiter.ts`（`activePluginId`）
  - `packages/stage-engine/src/interaction-kernel/pan-plugin.ts`（新增）
  - `packages/stage-engine/src/interaction-controller.ts`（删除 pan 分支、注册 pan 插件、
    `send` 改用 `activePluginId`、构造扩展后的 `pluginContext`）
  - `interaction-controller.test.ts` 保持不变即为无行为变化的证据
