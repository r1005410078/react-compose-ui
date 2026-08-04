# 变更：重构左侧基础组件与历史 Dock

## 原因

当前组件库作为 Scene Graph 的同级外层 Edge 标签，和场景编辑的连续工作流割裂；其纵向卡片列表
也在狭窄侧栏中占用过多空间。历史已经位于场景树下方，适合与组件库共享该下方工具区。

## 变更内容

- 将左侧外层 Edge Group 收敛为单一 Scene Graph 面板；在其内部固定上方场景树、下方工具 Dock。
- 下方工具 Dock 始终提供“基础组件”，并在 History 可用时提供“历史”标签；基础组件默认选中。
- 将 `ComposeComponentPalette` 改为可折叠的“基础 (N)”分类九宫格，保留现有点击新增和拖入 Stage 行为。
- 更新中英文工作区文案、样式、组件测试和编辑器端到端覆盖。

## 影响

- 受影响规范：`editor-workspace-layout`、`stage`
- 受影响代码：`@compose-ui/editor` 工作区初始化与内嵌 Dock，`@compose-ui/stage` 组件库 Palette
