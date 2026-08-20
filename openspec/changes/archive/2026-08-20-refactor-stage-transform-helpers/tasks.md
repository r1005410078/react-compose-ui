# 任务：把变换手势的共享判定与提交规划抽成纯函数

**验收铁律**：`interaction-controller.test.ts`（2225 行）与全部 e2e **一行不改**仍然全绿。
允许新增测试，不允许修改既有断言。

**本步的额外纪律**：**只搬不改**。提交体里三种类型的 `position` 计算高度相似，看上去可以
合并——不要合并，那些差异是刻意的业务规则。任何简化留到三个插件都抽完之后再谈。

## 1. 纯函数（纯新增，尚无调用方）

- [x] 1.1 新增 `transform-planning.ts`：`resolveTransformTargets({ document, index, type,
      ids, handle })` → `{ editableIds, bounds } | null`，逐字搬运 `startTransform`
      （`:1721-1747`）的约束过滤与 bounds 计算
- [x] 1.2 同文件 `planTransformCommit({ document, layoutSnapshot, index, finished,
      idFactory })` → `StageInteractionEffect | null`，逐字搬运融合提交体（`:2426-2526`）
- [x] 1.3 TSDoc 写明：两者无副作用；`document` 与 `index` 必须同一求解周期

## 2. 单测（这两段逻辑此前无法单独测试）

- [x] 2.1 `resolveTransformTargets`：五种 resize 模式与手柄配对、`movable`/`rotatable`、
      锁定与不可见排除、组件实例最外层强制 free、无目标返回 null
- [x] 2.2 `planTransformCommit`：move 排除 Flow 目标、持久绝对位置扣 border inset、
      move 非 Fill 轴保留持久值、resize 只改被拖动轴、rotate 取持久位置与尺寸、
      无更新返回 null

## 3. 接线（每步独立提交）

- [x] 3.1 `startTransform` 改为调用 `resolveTransformTargets`，保留手势创建与快照发布
- [x] 3.2 提交分支改为调用 `planTransformCommit`，保留把结果推进 `effects` 的职责

## 4. 验证

- [x] 4.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 4.2 `bun run test:e2e`：重点核对 move/resize/rotate 的松手落点与 Auto Layout 相关用例
- [x] 4.3 `interaction-controller.ts` 2879 → 2773 行，净减 106（目标解析 11、提交体 101、
      连带删除已无调用方的 `selectionBounds` 与两个 import）
- [x] 4.4 `docs/stage-plugin-kernel-roadmap.md` 记录本步为 `rotate-tool` 的前置

## 5. 实施记录

- [x] 5.1 stage-engine 测试 214 → 226（新增 12 例纯函数用例）；
      `interaction-controller.test.ts` 一行未改
- [x] 5.2 写测试时夹具把 `StageTransform` 写成了转换**之后**的 `{position,size}` 形状，
      被 `as StageTransform` 掩盖，只在 resize 用例上暴露（move/rotate 取持久值所以蒙混过关，
      position 实际已是 NaN）。去掉 cast 让类型系统兜住，并补一条 `Number.isFinite(position.x)`
      断言，使同类夹具错误无法再静默通过
- [x] 5.3 验证：lint、typecheck 46/46、test 45/45、build 24/24、e2e 99/99
