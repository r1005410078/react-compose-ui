# 变更：把变换手势的共享判定与提交规划抽成纯函数

## 原因

这是 [Stage 插件化内核重构路线图](../../../docs/stage-plugin-kernel-roadmap.md) **步骤 3**
下一刀（`rotate-tool`，优先级 1600）的**前置**。抽取顺序不变量要求自上而下，因此
`rotate-tool` 必须是 `pan` 之后的下一项——但读代码发现它没法像 pan 那样直接抽走：

- **claim 侧共享**：`startTransform`（`interaction-controller.ts:1721-1822`，约 100 行）是
  move / resize / rotate **三者共用**的目标解析与手势创建工厂。它做约束过滤
  （`movable` / `rotatable` / resize 模式与手柄的配对、组件实例最外层强制 free）、算选区
  bounds，然后按类型建三种手势之一。rotate 走了它，move（`:2060`、`:2103`）和
  resize（`:2110`）也走它。
- **commit 侧共享**：提交分支是
  `finished.type === 'move' || 'resize' || 'rotate'` 的**融合体**
  （`:2426-2526`，约 100 行），三者共用一段规划逻辑。

也就是说，直接抽 `rotate-tool` 会一次性搬动约 200 行、且必须同时决定 move/resize 怎么继续
用这些逻辑。pan 那一刀的教训是我低估了耦合并因此引入回归；这次先把共享部分变成**可独立
测试的纯函数**，再让插件抽取变成机械操作。

顺带的独立收益：这两段逻辑现在埋在 `begin`/`finish` 的闭包里，无法单独测试，而它们编码的
是实打实的业务规则——

- move 对 Flow 目标不写 offset（位置由 Auto Layout 决定，写了也是无效值）；
- 持久化绝对位置要扣掉父级 border inset；
- move 的非 Fill 轴保留持久值，避免把 Yoga clamp 后的尺寸误记成一次 Resize；
- resize 只有被拖动的轴取新尺寸；
- rotate 位置与尺寸都取持久值。

## 变更内容

- 新增 `packages/stage-engine/src/transform-planning.ts`，导出两个纯函数：
  - `resolveTransformTargets({ document, index, type, ids, handle })`
    → `{ editableIds, bounds } | null`。承担 `startTransform` 的过滤与 bounds 计算，
    **不**创建手势、**不**发布快照、**不**产生 effect。
  - `planTransformCommit({ document, layoutSnapshot, index, finished, idFactory })`
    → `StageInteractionEffect | null`。承担融合提交体的全部规划，返回至多一个
    `command.dispatch`。
- `interaction-controller.ts` 改为调用这两个函数；`startTransform` 保留手势创建与快照发布
  职责，提交分支保留把结果推进 `effects` 的职责。
- **无行为变化**，不新增插件，不改变优先级表，不动任何手势的归属。

## 影响

- 受影响的规范：`stage-engine`（受约束变换 System：明确判定与提交规划是可独立测试的纯函数）
- 受影响的代码：
  - `packages/stage-engine/src/transform-planning.ts`（新增）
  - `packages/stage-engine/src/transform-planning.test.ts`（新增：约束配对、Flow 过滤、
    border inset、非 Fill 轴保留、resize 轴选择、rotate 取持久值）
  - `packages/stage-engine/src/interaction-controller.ts`（改为调用；净减少行数）
  - `interaction-controller.test.ts` 与 e2e 保持不变即为无行为变化的证据
