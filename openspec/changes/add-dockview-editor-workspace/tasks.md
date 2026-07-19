## 1. 建立依赖与样式契约

- [x] 1.1 在开始实现前运行 `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`，恢复当前工具链升级造成的基线失败，且不要把无关修复混入本变更提交。
- [x] 1.2 在 `packages/editor/package.json` 添加 `dockview-react@^7.0.2`，保持 React/ReactDOM 为 peer dependency，并更新 `bun.lock`。
- [x] 1.3 创建 `packages/editor/src/styles.css`，引入 Dockview 基础样式并添加作用域限定的工作区样式。
- [x] 1.4 更新 `packages/editor/vite.config.ts` 和 `packages/editor/package.json`，产出并导出 `@compose-ui/editor/styles.css`，然后用 `bun run --cwd packages/editor pack:dry-run` 验证 JS、声明文件和 CSS 都包含在包中。

## 2. 实现 Dockview 编辑器工作区

- [x] 2.1 先在 `packages/editor/src/index.test.tsx` 增加失败测试，覆盖左/右/底三个 Edge Groups、中央 Canvas 主组、五个面板、六份插槽内容、HTML 属性透传和 React Strict Mode 下不重复初始化。
- [x] 2.2 在 `packages/editor/src/workspace-context.tsx` 定义 `sceneGraphPanel`、`canvasToolbar`、`children`、`inspectorPanel`、`transactionLogPanel`、`commandPanel` 六份 React 内容的内部 context，不导出 Dockview 类型。
- [x] 2.3 在 `packages/editor/src/workspace-panels.tsx` 创建 Scene Graph、Canvas、Component Inspector、Transaction Log、Command 五个内部面板渲染器；Canvas 渲染器把工具栏固定在内容顶部，其余插槽缺省时显示可访问的占位内容。
- [x] 2.4 在 `packages/editor/src/workspace-tab.tsx` 基于 Dockview 默认标签创建固定标签渲染器，保留标题与 Edge Group 活动标签折叠行为，但隐藏关闭入口且不提供关闭上下文菜单。
- [x] 2.5 在 `packages/editor/src/workspace-layout.ts` 定义固定组 ID、面板 ID 和默认尺寸，并实现幂等的 `initializeWorkspace(api)`：先创建中央 Canvas，再以 `addEdgeGroup('left'|'right'|'bottom')` 创建三个 Edge Groups，最后把两个底部面板放入同一个组。
- [x] 2.6 在 `packages/editor/src/index.tsx` 集成 `DockviewReact` 和 workspace context，设置 `disableDnd` 与 `disableFloatingGroups` 固定四区骨架，同时保留根 `<section>` 的 ARIA、data 属性和 HTML 属性透传。
- [x] 2.7 运行 `bun run --cwd packages/editor test` 与 `bun run --cwd packages/editor typecheck`，确认单元测试和公共类型通过。

## 3. 更新示例纵向流程

- [x] 3.1 修改 `app/src/App.tsx`，在 `sceneGraphPanel` 展示 Page 1 与文本节点，在 `canvasToolbar` 放置“添加文本组件”和画布工具占位，在 `children` 保留可选画布，在 `inspectorPanel` 放置属性输入框，在底部两个插槽提供事务列表和命令输入，并继续通过 `@compose-ui/preview` 展示实时结果。
- [x] 3.2 修改 `app/src/App.css` 和应用入口样式导入，按效果图建立深色全高工作台，确保编辑器工作区拥有确定高度，并为窄屏提供可操作的最小尺寸而不是把四区改回普通文档流。
- [x] 3.3 更新 `e2e/integration.spec.ts`，验证 Scene Graph、Canvas、Component、Transaction Log、Command 标题可见，确认左/右/底组具有 Edge Group 标识，添加文本与属性编辑仍能同步 Preview，并验证左侧分隔条缩放及底部活动标签折叠/展开。
- [x] 3.4 运行 `bun run test:e2e`，确认 Chromium 中默认布局与现有操作流程通过。

## 4. 文档与最终验证

- [x] 4.1 更新根 `README.md` 和 `packages/editor/README.md`，说明四区 Dockview 工作区、三个 Edge Groups、六份内容插槽、`styles.css` 导入、高度要求以及布局暂不持久化。
- [x] 4.2 运行 `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e` 和 `bun run pack:dry-run`。
- [x] 4.3 确认 `@compose-ui/core` 仍不依赖 React/Dockview，`@compose-ui/preview` 不依赖 editor，跨包导入仅使用公开 `@compose-ui/*` 入口。
