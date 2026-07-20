## 上下文

`@compose-ui/editor` 是可嵌入宿主 React 应用的编辑器入口，目前只渲染一个 `<section>`。目标界面分为四个宏观区域：左侧 Scene Graph、中间画布和工具栏、右侧 Component Inspector、底部 Transaction Log 和 Command。项目尚未确定正式文档 Schema、组件注册协议、命令模型或持久化接口，因此本次变更只能解决工作区布局，不得把 Dockview 的面板模型提升为编辑器领域模型。

Dockview 7 提供 React 绑定、普通组、Edge Groups、标签页、尺寸调整和布局序列化。它通过 `DockviewReact` 的 `onReady` 提供 `DockviewApi`，所有布局变更经由该 API 完成。Edge Groups 是固定在布局四边的结构元素，支持折叠和尺寸记忆，且不会转换为浮动或弹出窗口，适合作为 Scene Graph、Inspector 和日志区的外壳。

## 目标/非目标

- 目标：在 `ComposeEditor` 内提供 Scene Graph、画布、Component Inspector、Transaction Log/Command 四个宏观区域。
- 目标：左、右、底部区域使用 Dockview Edge Groups，并允许缩放、折叠和展开。
- 目标：画布及画布工具栏作为不可拆分的中央主工作区。
- 目标：保留当前 `children` 与标准 HTML 属性的兼容性。
- 目标：让 Dockview 保持为 `@compose-ui/editor` 的内部实现细节。
- 目标：提供明确、可打包、可由宿主导入的编辑器样式入口。
- 非目标：定义页面文档 Schema、组件注册协议或编辑命令。
- 非目标：保存布局到 localStorage、后端或页面文档。
- 非目标：将 `@compose-ui/preview` 嵌入编辑器包。
- 非目标：在公共 API 中暴露 `DockviewApi`、`SerializedDockview` 或 Dockview 面板对象。
- 非目标：首版支持浮动窗口、浏览器弹出窗口或自定义面板注册。

## 决策

### 使用三个 Edge Groups 和一个中央主组

首次挂载时创建以下 Dockview 组与面板：

| 组 ID | 类型/位置 | 面板 ID | 标题 | 内容来源 |
| --- | --- | --- | --- | --- |
| `compose-scene-edge` | Edge Group / `left` | `compose-scene-graph` | Scene Graph | `sceneGraphPanel` |
| `compose-canvas-group` | 普通主组 / 中央 | `compose-canvas` | Canvas | `canvasToolbar` + `children` |
| `compose-inspector-edge` | Edge Group / `right` | `compose-inspector` | Component | `inspectorPanel` |
| `compose-bottom-edge` | Edge Group / `bottom` | `compose-transaction-log` | Transaction Log | `transactionLogPanel` |
| `compose-bottom-edge` | Edge Group / `bottom` | `compose-command` | Command | `commandPanel` |

左、右、底部 Edge Group 分别使用约 `280px`、`340px`、`220px` 的初始尺寸，并设置防止内容完全不可用的最小尺寸；中央组获得剩余空间。Transaction Log 是底部初始活动标签，Command 与它共享底部 Edge Group。初始化前必须用 `getEdgeGroup(position)` 和 `getPanel(id)` 检查现有结构：`addEdgeGroup` 在同一边缘重复调用会抛错，因此 React Strict Mode 重放时不得创建重复组或面板。

### 使用 React 插槽传递业务内容

`ComposeEditorProps` 继续继承 `HTMLAttributes<HTMLElement>`，并新增：

```ts
export interface ComposeEditorProps extends HTMLAttributes<HTMLElement> {
  sceneGraphPanel?: ReactNode
  canvasToolbar?: ReactNode
  inspectorPanel?: ReactNode
  transactionLogPanel?: ReactNode
  commandPanel?: ReactNode
}
```

`children` 渲染到 Canvas 面板的内容区域，`canvasToolbar` 固定渲染在同一面板内容顶部，不作为可独立拖动的 Dockview 面板。其余插槽进入对应边缘面板；缺省时显示简短占位内容。面板渲染组件通过内部 React context 读取插槽，不把 ReactNode 放入 Dockview 的可序列化 `params`。

### Edge Group 交互边界

Scene Graph、Component Inspector 和底部日志/命令区可以通过其活动标签折叠或展开，也可以拖动与中央区之间的分隔边界改变尺寸。`DockviewReact` 使用 `disableDnd` 和 `disableFloatingGroups` 固定基础骨架；内部固定标签渲染器隐藏关闭入口，且不提供关闭/浮动上下文菜单。中央 Canvas 和三个 Edge Groups 因此不会被用户拆散，底部 Transaction Log 与 Command 仍可通过点击标签切换。

### Dockview 保持内部实现细节

公共入口不导出 `DockviewApi`、面板 ID 常量或序列化类型。这样未来可以替换布局库，也不会让宿主依赖 Dockview 的具体 API。面板布局状态与未来页面文档状态分离；重新挂载编辑器恢复默认布局。

### 显式样式入口

创建 `packages/editor/src/styles.css`，引入 Dockview 基础样式并定义 `ComposeEditor` 根容器和面板内容样式。构建产物暴露 `@compose-ui/editor/styles.css`；`package.json` 将 CSS 标记为有副作用，避免被宿主 tree-shaking。README 和示例应用必须展示显式导入。

### 保持包边界

`dockview-react` 是 `@compose-ui/editor` 的直接运行时依赖。React、ReactDOM 和 JSX runtime 继续作为 peer dependency 与构建 external，避免宿主加载多份 React。`@compose-ui/core` 不依赖 Dockview，`@compose-ui/preview` 也不依赖 `@compose-ui/editor`。

## 考虑过的替代方案

- CSS Grid：依赖最少，但需要自行实现拖拽停靠、面板重排、键盘导航和布局生命周期，不适合验证 IDE 式工作区。
- `react-mosaic-component`：可以完成分屏，但对标签组和完整 docking 工作流的支持弱于 Dockview。
- 使用四个普通 Dockview 组：可以完成视觉分区，但边缘工具区会参与普通拖拽、浮动和弹出，且缺少 Edge Group 原生折叠语义，因此不采用。
- 直接公开 Dockview API：扩展灵活，但会把第三方类型固化为公共协议，并绕过尚未确定的编辑器领域模型，因此首版不采用。
- 立即持久化 `api.toJSON()`：Dockview 支持序列化，但项目尚未确定持久化接口和版本迁移策略，首版延后。

## 风险/权衡

- Dockview 增加包体积和 CSS 约束 → 使用明确的样式子路径导出，并在 pack dry-run 中验证产物。
- 宿主未设置高度会导致工作区不可见 → `ComposeEditor` 提供合理的最小高度，文档仍要求宿主为生产布局提供确定高度。
- Strict Mode 可能重复触发布局初始化且 `addEdgeGroup` 会对重复边缘抛错 → 同时使用实例级 ref 与 `getEdgeGroup`/`getPanel` 守卫，并通过 Strict Mode 单元测试验证只有三个边缘组和五个面板。
- Dockview 内部状态可能与 React 插槽更新脱节 → 面板渲染器通过 context 消费最新 ReactNode，而不是把内容快照写入 Dockview params。
- Dockview 主题可能影响宿主样式 → 仅在编辑器根节点内应用主题类和覆盖变量，不修改全局元素样式。
- 固定布局会牺牲 Dockview 的自由拖拽能力 → 首版只把 Dockview 用于 Edge Group、标签、缩放和折叠；未来如需自定义工作区，由独立提案定义解锁与恢复默认布局的公共协议。
- 当前工具链依赖升级存在已知失败 → 实现前先恢复仓库基线检查，Dockview 变更不得掩盖或混入无关工具链修复。

## 迁移计划

1. 恢复并确认仓库基线检查可通过。
2. 添加 `dockview-react` 依赖、样式入口和打包导出。
3. 在保持现有 HTML 属性及 `children` 兼容的前提下实现三个 Edge Groups 和中央 Canvas 主组。
4. 将示例应用的场景节点、画布工具、画布、属性输入框、事务记录和命令输入映射到对应插槽。
5. 更新单元测试、E2E、README，并运行完整验证。

回滚时移除 Dockview 依赖和样式导出，将 `ComposeEditor` 恢复为语义化 `<section>`；由于首版不持久化 Dockview JSON，不需要数据迁移。

## 待解决问题

- 无。自定义面板注册、布局持久化、浮动/弹出窗口和布局重置命令分别留待后续提案。
