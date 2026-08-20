## 上下文

步骤 3 的第一刀，也是**优先级表第一次真正生效**的一步。步骤 2 刻意把「建表」与「用表」
分开，就是为了让这一刻只承担一件事的风险。

验收标准与步骤 2 相同：`interaction-controller.test.ts`（2225 行）与全部 e2e 一行不改仍全绿。

## 目标/非目标

- 目标：pan 成为真实插件；legacy 净瘦身；契约按 pan 的实际需要补两项。
- 非目标：其余 11 个手势；Overlay 拆分；`compose-stage.tsx` 瘦身。
  **不为将来的手势预留任何字段**——契约只按当前这一个插件的真实需要扩展。

## 决策

### 决策一：契约扩展只由 pan 的实际需要驱动

pan 暴露了两个缺口，都不是猜的：

1. claim 要读 `snapshot.temporaryPan`。这是内核状态（按住 Space 期间跨会话存活），
   `StagePluginContext` 只有 `context`/`index`/`apply`/`publish`，拿不到。→ 加只读 `snapshot`。
2. 发布时要 `initialSnapshot(snapshot.temporaryPan)` 作为基线。`initialSnapshot` 现在是
   模块私有函数。→ 加 `idleSnapshot()`，而不是导出那个函数：「空闲快照长什么样」应当由
   内核单点定义，导出裸函数会让每个插件各自记住「要把 temporaryPan 传进去」这条规则。

考虑过把 `temporaryPan` 单独提成一个字段而不暴露整个快照——否决：后续插件（marquee 要读
`marqueeHitTest`、move 要读 preview transforms）迟早需要更多字段，逐个开洞会让契约碎成一堆
布尔。只读整份快照是对称的：插件读 `snapshot`、写 `publish`。

### 决策二：`activePluginId()` 而不是 `activeGestureType()`

`send` 在 `temporary-pan.end` 上要判断当前会话是不是 pan。会话类型对内核是不透明的，
但**谁创建了它**是内核知道的事实。因此暴露插件 id，而不是让会话自报手势类型——后者等于把
手势分类重新塞回内核，正是这次重构要消除的东西。

`temporary-pan.start` 里那个 `gesture?.type === 'move'` 分支同理，但 move 还没搬迁，
本步保持读 `gesture`，等 move 迁移时一并改。

### 决策三：pan 会话的 commit 是纯清理

`finish()` 里没有 pan 分支，说明 pan 松手不产生任何 effect。插件的 `commit` 因此只做
「发布空闲快照 + 释放指针捕获」，与 legacy 松手落到公共尾部的效果逐字相同。

这一点必须在实现时对着 `finish()` 的尾部逐行核对：尾部是
`apply(effects)`（effects 为空）→ `publish(initialSnapshot(...))` → `apply([pointer.release])`。
顺序不能变——释放捕获必须在发布之后。

### 决策四：删除 legacy 分支是本步的一部分，不是后续清理

如果只加插件不删 legacy 分支，两处判定会同时存在，行为靠「pan 优先级更高所以 legacy 永远
轮不到」维持——这是隐式依赖，一旦优先级写错就会静默回退到 legacy 且没有任何报错。
删掉分支后，写错优先级会立刻表现为「平移完全失灵」，是可见的失败。

因此本步的完成判据包含：`Gesture` 联合不再有 `pan` 变体，`begin`/`updateGesture` 不再有
pan 分支，legacy 行数净减少。

## 风险/权衡

- **优先级表首次生效**：pan 的优先级 1700 只高于 legacy(0)，中间没有别的插件，因此本步
  实际只验证「表能用」，还验证不了「表的顺序对」。真正的顺序风险要等第二、三个插件落地
  （尤其是三个 marquee 入口之间夹着 draw/resize 的那段）。
- **`snapshot.temporaryPan` 的读取时机**：claim 时读的必须是当前值。`pluginContext.snapshot`
  用取值器实时读取，不能快照式捕获——按住 Space 期间 `temporaryPan` 会变。
- **e2e 覆盖**：临时平移（Space）与中键平移都有 e2e，是本步的主要保障。

## 迁移计划

1. 扩展契约（`snapshot`、`idleSnapshot`、`activePluginId`）并补内核单测。
2. 新增 pan 插件并注册。
3. 删除 legacy 的 pan 分支。

前两步做完时 pan 有两处实现（插件优先），第三步才唯一化。每步独立提交，任一步测试变红
即回退该步。

## 待解决问题

- `pan` 与 `temporaryPan` 的关系在插件化后是否应当反过来——由 pan 插件持有「临时平移」状态，
  而不是内核。本步不动：`temporaryPan` 在没有任何会话时也要存活（它影响光标与后续 claim），
  归属插件会让「没有会话时谁持有它」变得没有答案。留到全部手势搬完后重新评估。
