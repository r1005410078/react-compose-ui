# 变更：场景/检查器改为可折叠边缘轨道，底部保持满宽

## 原因

当前左侧 Scene Graph 与右侧 Component Inspector 是主 Dockview 网格里的普通 `Group`（非
`addEdgeGroup`），这是 `packages/editor/src/workspace-layout/workspace-layout.ts:159-160` 里
明确记录的取舍：Dockview 的 shell 结构中，`left`/`right` 边缘组位于最外层 splitview，
`top`/`bottom` 边缘组则嵌套在两者之间的“中间列”内部——同一个 Dockview 实例里不可能既有
`left`/`right` 边缘组，又让 `bottom` 边缘组横跨整个宽度。当前实现选择放弃 `left`/`right`
的边缘组身份，换取底部工具区（资源/动画/命令/日志）满宽显示。

代价是 Scene Graph 和 Inspector 因此失去了 Dockview 边缘组原生的“折叠为窄轨道 + 点击展开”
交互与视觉（对照 Dockview 官方 demo 里 Explorer / Outline 折叠后的竖排文字轨道）。用户希望
两侧具备这种折叠轨道体验，同时不能影响底部工具区已经满宽的现状。

## 变更内容

- 引入内层 `DockviewReact` 实例，专门承载 Scene Graph（`left` 边缘组）、Canvas（中央面板）、
  Component Inspector（`right` 边缘组）三个区域，复用 `left`/`right` 边缘组原生的折叠为轨道、
  展开、记忆尺寸行为。
- 外层 `DockviewReact` 实例收敛为单一中央面板（挂载内层 Dockview）+ `bottom` 边缘组（资源/
  动画/命令/日志），不再持有 `left`/`right` 边缘组，从而让 `bottom` 继续横跨整个编辑器宽度，
  不受内层折叠状态影响。
- 沿用 `SceneToolsDockview`（`packages/editor/src/workspace-layout/workspace-panels.tsx`）已经
  验证过的嵌套 Dockview 模式：`disableDnd`、`disableFloatingGroups`、`themeAbyss`、
  区分内外层 landmark 的 `aria-label`，避免辅助技术把两层 region 当成同一个。
- 现有“可选场景历史分栏”（Scene Graph 面板内部再嵌一层 Dockview 做场景/历史上下分栏）改为
  挂载在新内层 Dockview 的 `left` 边缘组面板下，行为不变。
- 更新 `editor-workspace-layout` 规范中“边缘工具区”的场景描述，新增折叠轨道相关场景，并
  显式记录“底部工具区满宽、不受两侧折叠影响”这条约束。

## 影响

- 受影响规范：`editor-workspace-layout`
- 受影响代码：`packages/editor/src/workspace-layout/workspace-layout.ts`、
  `packages/editor/src/workspace-layout/workspace-panels.tsx`、
  `packages/editor/src/compose-editor/compose-editor.tsx`（挂载点与 `workspaceComponents` 映射）、
  相关组件测试与 `app/` Playwright e2e 覆盖
