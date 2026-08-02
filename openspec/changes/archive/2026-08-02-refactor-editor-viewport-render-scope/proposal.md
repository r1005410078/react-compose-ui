# 变更：收敛视口更新的渲染范围

## 原因

`viewport` 是 `useComposeEditorController` 的 `useState`，而 controller 每次渲染都重新构造
`stage`、`inspectorPanel`、`stageToolbar`、`componentLibraryPanel` 等元素，第一方 chrome 组件
之间没有任何记忆化边界。结果是「平移画布」这种只改变一个 CSS transform 的操作，会在每个平移帧
重渲整棵编辑器树：场景树全部行、Inspector、工具栏、标尺与菜单。

实测（生产构建、1500 个 Entity、中键拖拽平移）：

| 挂载方式 | 帧间隔 p50 | p95 | >20ms 帧 |
| --- | --- | --- | --- |
| 只挂 Stage | 8.4 ms | 18.2 ms | — |
| 完整编辑器 | 16.1 ms | 24.3 ms | 8～26 |

Stage 侧的场景内容重渲已作为非破坏性性能修复单独交付；剩下的这一半开销来自编辑器 chrome，
需要改变 viewport 会话状态的归属与订阅方式，属于公共 controller 协议调整，因此走提案。

## 变更内容

- 把 viewport 从「controller 渲染态」改为「controller 持有的可订阅会话状态」，使 `setViewport`
  不再强制宿主与全部面板重渲；订阅方通过 `useSyncExternalStore` 获取快照，与既有
  `StageInteractionController` 的模式一致。
- 明确 `controller.viewport` 的读取语义：宿主读取仍返回当前快照，但只有订阅方在 viewport 变化时
  重渲。需要跟随 viewport 的宿主使用新的订阅入口。
- 补齐回归护栏：平移帧不得重渲与 viewport 无关的面板，也不得重建场景内容。

原提案还包含「为第一方 chrome 组件建立记忆化边界」。实现后复测显示视口订阅化已经让平移路径
完全绕开 chrome（1500 Entity 下 p50 8.3ms、0 帧超过 20ms），该项没有可测收益，已载去，详见
tasks.md 第 3 节记录的实测数据。

## 影响

- 受影响规范：editor-workspace-layout、stage。
- 受影响包：editor、scene-tree、stage；components 只在需要 memo 边界时调整导出组件。
- 公共 API：新增 viewport 订阅入口；`controller.viewport` 的重渲语义变化需要在 README 与
  package TSDoc 中说明，属于需要 changeset 标注的行为变更。
