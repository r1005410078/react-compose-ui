# 任务：动画并入工作区

- [x] 1.1 `workspace-definition`：`ComposeWorkspacePanelName` 加 `timeline`，映射到既有面板 id；
      preset 建造与快照校验认识它；新增内建 `animation`（底部 `[timeline, assetBrowser, command,
      transactionLog]`、展开、时间线活动），本地化标题与说明
- [x] 1.2 `compose-editor`：删除 `setEditorMode` 里的面板增删与折叠恢复；`AnimationPanel` 宿主不再
      按模式渲染 `null`，改为常驻渲染 + chrome 上的「动画编辑」开关（`aria-pressed`）
- [x] 1.3 开关的三条入口：按钮、既有的 `document.toggleAnimationMode` 动作（没有时间线时给出不可用原因）、时间线交互
      （`onPanelValueChange` / `onPanelAction` / 创建动画到达时若未开启则开启）
- [x] 1.4 退出：时间线面板不可见（Dockview `onDidActivePanelChange` / 面板移除）即退出；工作区切换
      到没有时间线的布局即退出；切换永不打开
- [x] 1.5 删除 `EditorModeSwitcher`、`ComposeEditorMode`、chrome 的 `editorMode` /
      `onEditorModeChange` 与相关 i18n；`use-workspace-session` 的 `restoreAnimationPanel` 删除
- [x] 1.6 组件文档：时间线面板与开关同样工作，作用域为组件根 Frame（既有用例改入口即可）
- [x] 1.7 Testing Library：切换到动画工作区不进入动画编辑；拖播放头进入；切到绘图退出；
      「动画编辑」出现在命令面板
- [x] 1.8 `e2e/support/test-helpers.ts` 加 `enterAnimationEditing(editor)`；十份用例改用它；
      新增用例：动画工作区按文档记忆、重开页面停在关闭态、切换工作区不产生事务
- [x] 1.9 README 与 AGENTS.md：动画不再是模式切换器上的一段；「唯一保留的全局开关」那段改写成
      「动画编辑开关」
- [x] 1.10 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
