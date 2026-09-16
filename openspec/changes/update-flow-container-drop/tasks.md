## 1. 落点解算

- [x] 1.1 `StageDropTarget.reorder` 的 TSDoc 改写为「落进 `containerId` 的第 `index` 位」，
      与 `grid-cell` 同一句话
- [x] 1.2 跨容器落进 Flex 容器时复用 `resolveInsertIndex`（未另抽函数：`resolveStageDropTarget`
      末尾三行即可，多一层间接不换来任何东西）
- [x] 1.3 `resolveStageDropTarget` 在 Flex 容器分支返回插入位落点，而不是裸 `reparent`
- [x] 1.4 候选容器解析：Flex 容器的 Flow 子级不接管落点（`alt` 例外）
- [x] 1.5 深入判定失败时上浮到最近的成立祖先，而不是返回 null
- [x] 1.6 抽出 `resolveStageDropParent`，`externalDrop`（物料面板拖放/点击添加/右键添加）
      一并走它

## 2. 提交

- [x] 2.1 `planMoveCommit` 在 `reorder` 的 `containerId` 不是当前父级时走
      `createReparentCommand` 并传入 `target.index`
- [x] 2.2 同父级仍走 `moveEntity`

## 3. 用例

- [x] 3.1 单测：跨容器插进 Flex 容器得到同级子项，且不是第一个子级的后代
- [x] 3.2 单测：插入位落在两个兄弟之间的正确 `childIds` 下标
- [x] 3.3 单测：Flow 子级不接管落点；`Alt` 下仍接管
- [x] 3.4 单测：边缘留白上浮到祖先
- [x] 3.5 单测：跨容器插入只产出一条命令
- [x] 3.6 e2e：从物料面板往 Auto Layout 容器连拖两个（第二下落在**第一个子级身上**），
      得到两个同级子项

## 4. 门禁

- [x] 4.1 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
