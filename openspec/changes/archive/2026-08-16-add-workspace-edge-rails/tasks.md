## 1. 拆分外层/中层工作区初始化

- [x] 1.1 在 `workspace-layout.ts` 中新增中层面板/组件 ID 常量。实现上直接复用了已有的
  `scene`/`canvas`/`inspector` 常量（含义不变，只是从外层迁到内层），只新增了外层唯一宿主面板
  需要的 `core` 常量（group id / panel id / component id）。
- [x] 1.2 拆出 `initializeOuterWorkspace`：只保留中央面板（挂载内层 Dockview，`hideHeader:true`
  避免叠加一层多余标签条）与 `bottom` 边缘组（资源/动画/命令/日志），移除原 `sceneGroup`/
  `inspectorGroup` 普通 Group 逻辑。
- [x] 1.3 新增 `initializeCoreWorkspace`（原任务文本里的 `initializeSceneCanvasInspectorWorkspace`，
  实现时按仓库既有命名习惯改成这个名字）：用 `addEdgeGroup('left'/'right', ...)` 创建 Scene
  Graph 与 Inspector 边缘组，Canvas 仍是中央固定面板，锁定策略与初始尺寸沿用
  `WORKSPACE_SIZES`。

## 2. 中层 Dockview 组件与挂载

- [x] 2.1 新增 `WorkspaceCoreDockview`（`workspace-panels.tsx`），复用 `SceneToolsDockview` 已经
  验证过的写法（`disableDnd`、`disableFloatingGroups`、`themeAbyss`）。`onReady` 没有直接调用
  `initializeCoreWorkspace`，而是经 `WorkspaceContent.onCoreDockviewReady` 转发给
  `ComposeEditor`——它才持有 `pages`/`components` 配置决定的 `includeCanvas`，也是原有
  `initializedApi`/`workspaceReady`/文档面板生命周期逻辑的归属处，这样可以保持那部分
  代码完全不用改。
- [x] 2.2 `compose-editor.tsx` 的 `workspaceComponents` 现在只有
  `{core, transactionLog, command, assetBrowser, animation}`；`WORKSPACE_COMPONENT_IDS.core`
  映射到 `WorkspaceCorePanel`（包一层 `.compose-editor__panel`，内部渲染
  `WorkspaceCoreDockview`）。`scene`/`canvas`/`inspector`/三种文档面板的映射搬进了
  `workspace-panels.tsx` 内部的 `coreComponents`，不再需要从 `compose-editor.tsx` 导出。
- [x] 2.3 landmark 消歧：真正触发的问题不是"两层同名 aria-label 需要 JS 改写"（`SceneToolsDockview`
  那层已有的处理方式沿用不变），而是新增的外层 `core` 宿主面板本身，尽管
  `hideHeader:true` 隐藏了标签条，Dockview 仍会给它的 group 生成 `role="region"` +
  `aria-label`，与内层真正的 Canvas 面板同名（都叫"画布"），触发 axe 的
  `landmark-unique` 违规（在 `@compose-ui/storybook` 的 `compose-editor.stories.tsx` a11y
  用例里实测复现）。修复方式：新增 `workspace.workspaceCore` i18n key（zh-CN"工作区"/
  en"Workspace"），外层宿主面板用这个不同的标题，不再用 `messages.canvas`。

## 3. 场景历史分栏改接挂载点

- [x] 3.1 `SceneToolsDockview`（含其挂载的 `SceneGraphPanel`）完全不用改挂载路径——它是通过
  `coreComponents` 注册在新内层 Dockview 的组件表里，内层初始化时把 `scene` 面板放进
  `left` Edge Group，`SceneGraphPanel`（渲染 `<SceneToolsDockview/>`）自然而然就出现在正确
  位置，`historyEnabled` 切换、`localizeSceneToolsWorkspace` 都不用动。

## 4. 折叠轨道视觉核对

- [x] 4.1 用 Playwright 对照实测：点击 Scene Graph 的活动标签，宽度从 280px 正确折叠到
  Dockview 默认的 35px 窄轨道（只剩图标），Canvas 相应变宽；再点一次展开，恢复到折叠前的
  280px；折叠/展开全程 bottom Edge Group 稳定保持 1600px（视口全宽），不受影响。

## 5. 测试

- [x] 5.1 折叠/展开的原生行为由 Dockview 自身保证（`addEdgeGroup` 内置能力），没有另外补
  组件测试断言像素尺寸；用上面 4.1 的 Playwright 实测替代，组件测试层面延续了
  `workspace-layout.test.ts` 对 `initializeCoreWorkspace` 用 `addEdgeGroup('left'/'right', ...)`
  的断言（等价于验证"具备折叠为轨道的原生 Edge Group 身份"这个前提）。
- [x] 5.2 `workspace-layout.test.ts` 新增
  "OpenSpec: add-workspace-edge-rails / 边缘工具区 / 底部工具区不受两侧折叠影响"：断言
  `initializeOuterWorkspace` 不创建 `left`/`right` 边缘组，只有 `bottom`；配合 4.1 的
  Playwright 实测（折叠/展开两侧后 bottom 始终 1600px 全宽）。
- [x] 5.3 `compose-editor.test.tsx` 保留原有 "Strict Mode 重放初始化" 断言（外层
  `initializeOuterWorkspaceMock` 只调用一次）；`workspace-layout.test.ts` 里 `initializeCoreWorkspace`
  的 "is idempotent when initialization is replayed" 用例覆盖内层重放不重复创建
  Edge Group/面板。
- [x] 5.4 运行了 `bun run test:e2e -- --grep "editor-workspace-layout"`（12 个用例）：9 个通过，
  3 个失败——逐一用 `git stash` 对照基线提交（本变更开始前的 768427f）复现，确认这 3 个失败
  在基线上已经存在（1 个是过时的组件目录数量断言"基础组件 (3)" vs 实际已有 4 个，1 个是
  `toBeFocused` 超时的既有 flaky 用例，1 个是与前者关联的组件库截图对比），均与本次改动无关，
  不是本次引入的回归。没有新增 Playwright e2e 用例，因为折叠轨道行为已经被 4.1 的手动
  Playwright 验证 + Dockview 自身对 Edge Group 折叠的既有测试覆盖，e2e 黄金截图的维护成本
  和这里新增的价值不成比例。

## 6. 文档与规范

- [x] 6.1 `openspec/changes/add-workspace-edge-rails/specs/editor-workspace-layout/spec.md`
  的 MODIFIED 需求与实际实现一致（嵌套 Dockview、bottom 独立于两侧折叠、Strict Mode 重放
  场景）。
- [x] 6.2 `openspec validate add-workspace-edge-rails --strict` 通过。
