# 变更：Stage 交互内核仲裁器与插件注册表

## 原因

这是 [Stage 插件化内核重构路线图](../../../docs/stage-plugin-kernel-roadmap.md) 的**步骤 2**，
在步骤 1（注入面聚合）之上落地 headless 内核骨架。本身不改变任何用户可见行为。

读 `interaction-controller.ts` 得到的事实是：**仲裁器已经存在，只是写成了 if 瀑布**。

- `Gesture` 联合有 **12 个变体**（pan、marquee、move、resize、segment-resize、rotate、
  guide-create、guide-move、paint、paint-sample、path、draw），每个都已经是「claim 时只读 +
  拖动期可变」的结构，与 Session 概念一一对应。
- `begin()`（`interaction-controller.ts:1698-2199`，**501 行**）是一条 claim 级联：逐个判定
  `event.hit.kind` 与 `context.tool`，命中就写 `gesture` 并 `return`。**`return` 就是「已接管」，
  级联顺序就是优先级**——但这个优先级现在只存在于代码行序里，没有任何地方声明它。
- `updateGesture()`（1394-1697，304 行）与 `finish()`（2201-2543，343 行）各自是同一组
  12 路分派。

也就是说，当前实现是「3 个函数 × 12 个手势」的矩阵，而插件化只是把它**转置**成
「12 个插件 × 3 个方法」。三个函数合计 1148 行（占全文件 41%），其余 1650 行是 context、
SceneIndex、snapshot 派生与 effect 管道——那部分正是内核该保留的。

不先落内核，步骤 3 的每个手势搬迁都没有可搬入的地方。

## 变更内容

- `@compose-ui/stage-engine` 新增交互内核协议与实现：
  - `StageInteractionPlugin`：`claim(event, ctx)` 纯判定是否接管。
  - `StageSession`：`update` 每帧产出效果（只写预览，不写文档）、`commit` 至多规划一个
    batch、`cancel` 无条件清理。
  - Session Arbiter：同一时刻至多一个会话，按声明的 `priority` 询问插件。
  - Plugin Registry：由组合根填充。
- **claim 结果是三态** `StageSession | 'consumed' | null`，不是两态。依据来自现有代码：
  `begin()` 中文字编辑守卫命中编辑目标时直接 `return`（已消费、不开会话、且必须阻止后续
  判定），`context.tool === 'rotate'` 的兜底 `return`（`:2197`）同理。两态契约无法表达它们。
- **`commit` 前保证一次以最终点的 `update`**：`finish()` 开头就调用
  `updateGesture(event.point, event.modifiers)`（`:2205`）。这条写进契约，避免 12 个插件
  各自重复实现「先吃掉最终点再提交」。
- 现有单体 controller 原样包装为**一个** `legacy-monolith` 插件整体注册，本步**不搬迁任何手势**。
- `createStageInteractionController()` 公共入口、`StageInteractionSnapshot`、
  `StageInteractionEffect`、`StageInteractionEvent` 与 surface port 协议**逐字不变**。
- 级联顺序固化为一张**显式优先级表**，并由单测锁定；这是本步唯一有真实回归风险的地方。
- **Overlay Registry 不在本步**（路线图原列于此）：步骤 4 之前它没有任何消费方，
  提前建注册表违反仓库「不得以未来可能复用为理由提前抽象」的规则。路线图同步修订。

## 影响

- 受影响的规范：`stage-engine`（Headless 交互 Controller 增加插件仲裁语义）
- 受影响的代码：
  - `packages/stage-engine/src/interaction-kernel/`（新增：契约、Arbiter、Registry）
  - `packages/stage-engine/src/interaction-controller.ts`（改为内核 + legacy 插件的组合；
    `begin`/`updateGesture`/`finish` 本体不动，只改由插件转调）
  - `packages/stage-engine/src/index.ts`（导出内核协议）
  - `interaction-controller.test.ts` 保持不变即为无行为变化的证据
