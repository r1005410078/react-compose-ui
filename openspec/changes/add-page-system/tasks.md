## 1. P1 纵向切片：创建 → 打开 → 编辑 → 保存

- [x] 1.1 `packages/core/src/page/page-types.ts`：页面后缀、页面媒体类型、清单文件名常量，
  `ComposeAppManifest`、`ComposePageReference`、`ComposePageDocumentLoader`、`ComposePageNestState`
- [x] 1.2 `packages/core/src/page/page-file.ts` + `page-file.test.ts`：后缀识别、显示名双向转换、
  页面文档解析/序列化、空白页面文档工厂（复用 `createDefaultCanvasSettings` /
  `createDefaultOutputSettings`）
- [x] 1.3 `packages/core/src/page/page-graph.ts` + `page-graph.test.ts`：
  `readComposePageReference`、深度上限常量、`resolveComposePageNestState`
  （自环、间接环、深度边界 7/8/9）—— 先落定协议，消费者在 `add-page-node-property`
- [x] 1.4 `packages/core/src/page/index.ts` 与 `packages/core/src/index.ts` 转导
- [x] 1.5 新包骨架 `packages/pages/`：`package.json`、`tsconfig`、构建与 dts 配置，对齐
  `packages/stage-engine` 的现有配置形态
- [x] 1.6 `packages/pages/src/page-catalog.ts` + 测试：递归列举、页面过滤、描述符生成、排序
- [x] 1.7 `packages/pages/src/page-store.ts` + 测试：读写、`createPage`、文档缓存与并发合并、
  `AbortSignal` 透传、`expectedRevision` 冲突与 `force`、`provider.subscribe` 桥接与缓存失效
- [x] 1.8 **纯重构提交（行为不变、测试全绿）**：抽出
  `packages/asset-browser/src/asset-browser/use-name-prompt.ts` 命名对话框状态机与
  `asset-context-menu.tsx` 菜单内容，内建新建/重命名继续走同一状态机
- [x] 1.9 `asset-browser-types.ts`：`ComposeAssetContextMenuContext`、
  `ComposeAssetNamePromptRequest`、`ComposeAssetContextMenuItem`、
  `ComposeAssetEntryRenderContext` 与 `contextMenuItems` prop（含 TSDoc）
- [x] 1.10 `asset-context-menu.test.tsx`：宿主项排序、可见/禁用、`promptName` 确认与取消及名称
  校验、`refresh` 重新列举
- [x] 1.11 `packages/editor/src/pages/use-page-workspace.ts`：Store 派生、目录订阅、页面会话 Map、
  打开/dirty/保存/冲突/关闭确认
- [x] 1.12 `workspace-context.tsx` / `workspace-layout.ts` / `workspace-panels.tsx` /
  `workspace-tab.tsx`：`ComposePageDocumentSession`、`pageDocument` 面板 id 与组件、脏点与关闭按钮
- [x] 1.13 活动页面运行时交回宿主（`pages.onActiveSessionChange`）—— 原计划的
  `active-page-controller.tsx` 未采用，见 design.md 决策 3
- [x] 1.14 `compose-editor.tsx`：`pages` 配置、`handleAssetOpen` 分流、
  `activeController = pageController ?? props.controller` 构建工作区插槽
- [x] 1.15 `packages/editor/src/pages/page-context-menu.tsx`：创建页面项 + `editor-i18n.ts` 文案
- [x] 1.16 `app/src/demo-asset-provider.ts` 增 `Pages/` 目录与页面 `mediaType`；
  `app/src/StageDemo.tsx` 接线 `pages`
- [x] 1.17 `page-workspace.test.tsx`：双击开页面面板、dispatch 后出现脏点、保存清除脏点、
  冲突弹覆盖对话框、关闭确认
- [x] 1.18 Playwright：右键创建页面 → 打开标签 → 拖动实体 → 保存 → 重开可见持久化几何
- [x] 1.19 `bun run lint && bun run typecheck && bun run test && bun run build`

## 2. P2 首页

> 2.1–2.4 已在 P1 提前完成：清单解析若留到 P2，`listPages` 会先返回一个不完整的目录形状；
> `renderEntryBadge` 与 `contextMenuItems` 属于同一处插槽面，分两次改反而更乱。

- [x] 2.1 `packages/core/src/page/page-manifest.ts` + `page-manifest.test.ts`：宽容解析、未知字段
  保留与写回、`setComposeAppManifestHomePage` 幂等、四类 issue
- [x] 2.2 `page-store.ts`：`readManifest`、`setHomePage`（惰性创建）、`canWriteManifest`，
  清单写冲突重读重试一次；补测试
- [x] 2.3 `asset-browser`：`renderEntryBadge` prop，文件树行与目录网格块双处渲染
- [x] 2.4 `asset-browser` 测试：标记在树与网格双处渲染、返回空结果时不产生额外元素、
  标记不参与命中测试
- [x] 2.5 `packages/editor/src/pages/page-badges.tsx`：`HomePageBadge`（`role="img"` + i18n 可读名）
- [x] 2.6 `page-context-menu.tsx`：设为首页项（只读 Provider 与已是首页时禁用）
- [x] 2.7 `use-page-workspace.ts`：`handleDefaultAssetMutation` 的清单对账（删除首页置空、
  重命名首页改写 key）、悬空 key 非阻断提示
- [x] 2.8 测试：设为首页后双处出现标记、首页转移、删除首页清空清单、只读 Provider 置灰、
  清单损坏与悬空 key 的降级
- [x] 2.9 Playwright：设为首页 → 双处标记 → 重载保持 → 第二个页面接管标记

## 3. P3 只读 JSON 查看

- [x] 3.1 `script-editor.tsx`：`readOnly` prop（Monaco `readOnly` + `domReadOnly`、不注册保存
  快捷键、不上报 dirty、`save()` 空转返回 true）
- [x] 3.2 `asset-preview.tsx`：`readOnly` prop 透传，`ComposeAssetPreviewHandle.save()` 空转
- [x] 3.3 `workspace-context.tsx`：`ComposeAssetDocumentSession.readOnly`；
  `createAssetDocumentPanelId` 增 `readOnly` 选项与 `:readonly` 后缀
- [x] 3.4 `workspace-panels.tsx`：只读时不注册保存、不显示脏点、标题加本地化只读后缀
- [x] 3.5 `compose-editor.tsx`：`openAssetDocument(entry, { readOnly })`；
  `page-context-menu.tsx` 增打开组件 JSON 配置项
- [x] 3.6 测试：只读下禁写、不上报 dirty、`save()` 空转；同一页面可与页面标签并存
- [x] 3.7 Playwright：右键打开组件 JSON 配置 → Monaco 只读、无脏点、无保存

## 4. 收口

- [x] 4.1 `editor-controller/controller.tsx`：`runtime` 变化时重置会话状态并重建
  `interactionController`（附中文注释说明会话状态是文档作用域），
  `controller.test.tsx` 断言选择/视口/检视目标被重置
- [x] 4.2 i18n 完整性：`editor-i18n.ts` 页面相关文案齐备，无硬编码可翻译文案
- [x] 4.3 a11y 复核：首页标记、宿主菜单项的 role / 可读名 / 键盘 / 焦点恢复
- [ ] 4.4 文档同步：`AGENTS.md`（`@compose-ui/pages` 边界）、`openspec/project.md`、`README.md`
- [ ] 4.5 配置同步：根 `package.json` 的 `pack:dry-run` 追加 `packages/pages`、`.changeset/` 变更集
- [ ] 4.6 全量验证：`bun run lint`（含 `check:architecture`）、`bun run typecheck`、`bun run test`、
  `bun run build`、`bun run test:e2e`
