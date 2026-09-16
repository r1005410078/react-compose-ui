# 变更：往 Flex 容器里拖东西按队列插入，而不是钻进上一个子项

## 原因

往一个 Auto Layout 容器里连拖三个容器，得到的是三层嵌套而不是三个同级子项
（`docs/dashboard-dogfood-issues.md` 的 L-2）。两条原因叠在一起：

1. 落点取指针下**最深**的容器，而排队容器里第一个子项本来就盖住了父容器中心，此后每一次
   拖放都落进上一个子项。
2. 跨容器落进 Flex 容器时解算器直接退成一句 `reparent`
   （`packages/stage-engine/src/hit-testing/drop-target.ts:435`），既不算插入位、也就没有
   插入指示线——而**网格容器早就有**这一支（`:432` 的 `resolveGridDropTarget`）。

结果是「往排队容器里拖第二个同级子项」这件事在画布上**做不到**，而屏幕上没有任何东西说明
为什么。绕道只有场景树的「新增节点」。

## 变更内容

- Flex 容器与网格容器对称：跨容器落进 Flex 容器时解算插入位，产出带 `containerId` 的
  `reorder` 落点，既有的插入指示线因此直接生效。
- **BREAKING**（类型语义，非运行时）：`StageDropTarget` 的 `reorder` 不再隐含「停留在原容器」。
  它与 `grid-cell` 统一为「落进 `containerId` 的第 `index` 位」，父级变没变由提交方比较得出。
- Flex 容器的 **Flow 子级不接管落点**：指针落在它身上时落点归它的 Flex 父级，插入位说明放在
  哪两个之间。按住 `Alt` 仍然钻进去——那正是 `alt` 的既有语义。
- 同一条规则抽成一处（`resolveStageDropParent`），**外部拖入**（物料面板拖放、点击添加、
  画布右键添加）一并走它——L-2 报的那条复现走的正是这条路，它此前直接取
  `index.containerAtPoint`。
- 最内层容器不满足「深入内部」判定时**上浮到最近一个满足的祖先**，而不是交回「没有落点」。

## 影响

- 受影响的规范：`stage-engine`
- 受影响的代码：
  - `packages/stage-engine/src/hit-testing/drop-target.ts`（解算与类型）
  - `packages/stage-engine/src/gesture-planning/move-planning.ts`（跨父级 `reorder` 的提交）
  - `packages/stage-engine/src/interaction-controller.ts`（外部拖入的落点归约）
  - `packages/stage/src/stage-overlay/layers/drop-indicator-layer.tsx`（无需改动，验证覆盖）
