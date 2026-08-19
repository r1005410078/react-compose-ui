# 任务

## 1. 协议层

- [x] 1.1 `@compose-ui/animation` 新增 `animation-file.ts`：文件类型、后缀/media type
      常量、`isComposeAnimationFileName`、`parseComposeAnimationFile`、
      `serializeComposeAnimationFile`、`createComposeAnimationFile`；导出并补 Vitest
      （往返、坏版本/坏形状/坏清单、命名助手）。
- [x] 1.2 `@compose-ui/core` 页面文件：`ComposePageAnimationReference` 类型、共享
      引用校验器、`ComposePageFile.animation`（容缺解析、序列化总是写出、
      `createEmptyComposePageFile` 置 null）；补解析容缺测试。
- [x] 1.3 `@compose-ui/pages`：`ComposePageStore.setPageAnimation`（乐观并发，镜像
      `setPageSetupScript`）；补 store 测试。

## 2. 面板与数据层

- [x] 2.1 `@compose-ui/animation-panel`：`ComposeAnimationTimeline` 新增受控
      `empty?: boolean`（缺省回退轨道数判定）；零轨道非空态提示行；补测试。
- [x] 2.2 `@compose-ui/editor` `animation-asset-store.ts`：`loadPageAnimation`、
      `createPageAnimationFile`（命名冲突唯一化）、`writePageAnimationManifest`；
      补测试。
- [x] 2.3 `use-page-workspace.ts`：`openPage` 水合镜像、`setPageAnimation`、
      `savePage` 回写动画文件、会话跟踪
      `{animationEntryId, animationRevision, animationManifest}`；补测试。

## 3. 编辑器 UI

- [x] 3.1 画布 Inspector 动画区块：`page-animation-scope-panel.tsx`（列同级动画
      文件、绑定/创建/取消关联）、从 `animation-inspector.tsx` 抽出
      `animation-binding-fields.ts` 复用变量绑定；`canvas-inspector.tsx` 新增
      `animationInspector` 透传字段（order 2，pageScript 升 3）；
      `compose-editor.tsx` 两处注入；i18n 中英文。
- [x] 3.2 模式切换器：`editor-mode-switcher.tsx`（设计/动画 segmented control，
      radiogroup ARIA）挂到 `PageDocumentPanel` 工具栏行保存按钮旁；
      `workspace-layout.ts` 移除默认动画面板；`compose-editor.tsx`
      `setEditorMode` 集中 Dockview 重组（加/移面板、展开/恢复折叠、防重入）、
      现有 `onDidActivePanelChange` 路由到 `setEditorMode('design')`；补组件测试。
- [x] 3.3 空态改造：CTA 状态感知（无绑定 → 创建文件+绑定+镜像；有绑定无镜像 →
      载入绑定动画）；`AnimationPanel` 传 `empty`；补测试。

## 4. 端到端与验证

- [x] 4.1 迁移 `e2e/integration.spec.ts` 中经底部动画标签进入动画模式的既有用例。
- [x] 4.2 新增 e2e：切「动画」→ 创建动画 → 时间线显示（非 CTA）→ 画布 Inspector
      动画区块位于页面脚本上方 → 保存 → 资源浏览器 Pages 目录出现动画文件 →
      切回「设计」底部恢复三标签 → 重进动画模式绑定持久。
- [x] 4.3 `bun run lint && bun run typecheck && bun run test && bun run build`、
      `bun run test:e2e` 全绿（70/70）。
