# 设计

## 为什么是 ECS Component 而不是 Renderer

Page Slot、Component Instance 那类物料把内容藏在 Renderer props 里，是因为它们的内容来自另一份
文档。WidgetSwitcher 的子项是**本文档的一等 Entity**：要能在场景树里拖拽排序、能被选中、能有自己的
Layout。因此它只能建立在 `Hierarchy` 之上，切换语义作为一个正交的可选 Component 附着上去。

这也让它天然可组合：任意已有容器加上 `widget-switcher` 能力就变成切换器，移除能力就退回普通容器，
子项一个都不丢。

## 隐藏语义放在哪一层

非活动子项的隐藏 **不写 `Visibility`**。两者语义不同：`Visibility` 是用户对单个 Entity 的显式意图，
会被 Inspector 与场景树的眼睛图标读写；switcher 的隐藏是由索引派生的结果。如果写进 `Visibility`，
切换索引就会覆盖用户手动设置的可见性，并且每次切换都产生文档事务。

因此在 core 提供一个纯派生函数，返回「本次渲染应跳过的 Entity ID 集合」，由各渲染入口在既有
`getComposeVisibility` 判断旁边合并。只需收集 switcher 的**非活动直接子项**——它们的后代由渲染与
索引本来就有的递归自然剪掉。

## 选中即预览为什么不写文档

UE5 设计器里点击层级树中 switcher 的某个子项，画布会切到它。若照搬成「选中即改 `activeIndex`」，
浏览操作就会变成可撤销的文档变更：点几下场景树，Undo 栈里就多几条无意义的记录，多人协作时还会互相
覆盖索引。

所以预览覆盖是 Stage 的 `useMemo` 派生量：从当前选择集向上走父链，遇到带 `WidgetSwitcher` 的祖先就
记下该链上的直接子项。取消选择即回到 `activeIndex`。真正要改的活动项仍然通过 Inspector 显式设置。

关键约束：这份覆盖 **必须同时喂给场景渲染和 SceneIndex**。只喂渲染会出现「看得见却点不到」——命中
测试仍认为该子项不可见，选中框、拖拽、reparent 全部失效。

## 索引钳制

`activeIndex` 允许越界存在（子项被删除后索引可能大于上限），读取时钳制到 `[0, childIds.length - 1]`，
空容器返回 `null`。不在删除子项时顺带改写索引：那会让一次删除产生两条语义无关的补丁，且 Undo 之后
索引未必能正确还原。钳制在读取侧是幂等的，也不污染文档。
