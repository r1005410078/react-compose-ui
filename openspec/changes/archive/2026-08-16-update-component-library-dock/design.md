## 上下文

左侧区域需要同时支持场景树、可新增的基础组件和会话历史。Dockview 的外层 Edge Group 适合表达
“左侧工作区”，而内部 Dockview 更适合表达固定上下区域与下方标签切换。组件库由 Stage 包拥有，
因为它直接驱动 Stage interaction controller。

## 目标/非目标

- 目标：场景树保持上方；下方基础组件默认显示；历史在可用时作为相邻标签；组件库使用紧凑分类网格。
- 非目标：不改变 Preset 注册协议、不新增 Grid 物料、不持久化 Dockview 布局、不改变外部拖入语义。

## 决策

- 外层左侧 Edge Group 只保留 Scene Graph；`ComponentLibraryPanel` 移入 Scene Graph 内部的工具组，
  从而避免出现两个相互竞争的左侧外层标签。
- 内层 Dockview 始终建立：上方是场景树，下面是工具组。工具组先创建基础组件面板并设为 active，
  History 仅在宿主提供 history 或 historyPanel 时加入同组。
- Palette 不扩展 Registry 的公开 Preset 模型：所有可见 Preset 先归入本地化的“基础”分类。这样可
  立即形成稳定分类视觉，且不会把尚未确定的分类体系变成公共 API。
- 分类标题是可聚焦 button，控制下方 grid 的展开状态；每个 Tile 继续是原有可点击、可拖拽的 button。

## 风险/权衡

- 旧调用方若依赖左侧 Edge 的组件库标签，视觉位置会变化；但 `ComposeEditor` 的公开插槽与
  `ComposeComponentPalette` API 均不变。
- 内层 Dockview 会在没有 History 时仍创建，用于稳定承载基础组件；这比按条件切换整个左侧内容
  更能保留场景树和下方面板的用户调整高度。

## 迁移计划

无需文档迁移或持久化迁移。新 Editor 实例按新默认拓扑创建；已挂载实例不热切换 Dockview 拓扑。
