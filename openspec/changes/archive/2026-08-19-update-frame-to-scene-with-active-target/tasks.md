# 任务

## 1. 协议层：`activeFrameId`

- [x] 1.1 `packages/core/src/page/page-types.ts`：`COMPOSE_PAGE_SCHEMA_VERSION` 2→3；
      `defaultFrameId` → `activeFrameId`，TSDoc 改写为「激活目标」；issue code
      `page.invalid-default-frame` → `page.invalid-active-frame`。
- [x] 1.2 `packages/core/src/page/page-file.ts`：允许键集合、校验、解析归一化与序列化跟随改名。
- [x] 1.3 新增 `migrateComposePageFileV2ToV3()`：纯函数，`defaultFrameId` 恒等搬到
      `activeFrameId`，不修改输入；普通解析对 v2 返回结构化 legacy issue。
- [x] 1.4 `packages/pages/src/page-store.ts`：`setPageDefaultFrame` → `setPageActiveFrame`。
- [x] 1.5 跟随改名的读取侧：materials `page-slot`（measurement/renderer/definition）、
      editor `use-page-workspace`、`compose-editor`。
- [x] 1.6 单测：迁移往返、悬空 id 报错、序列化恒定写出字段。

## 2. 三个既有缺陷（本变更内必须修，否则场景一等公民化后立刻可触发）

- [x] 2.1 **Frame resize 脱钩**：`appendSpatialTransformPatches` 只写 `LayoutItem.width/height`，
      而布局求解以 `Frame.size` 为准（`layout-runtime.ts:428-432`）。拖手柄缩放 Frame 会改文档
      但画面不动。修复：目标有 `Frame` 且尺寸变化时同一事务补写 `Frame.size`。
- [x] 2.2 **悬空 `activeFrameId` 写坏页面**：`writePage` 不校验，`savePage` 只做 `...session.page`
      透传；删掉激活场景再保存会写出悬空 id，而解析侧对悬空 id 直接报错 → 页面打不开。
      修复：保存时对账（`rootIds.includes(current) ? current : rootIds[0] ?? null`），
      core 提供读取侧 `resolveComposePageActiveFrameId(page)`。不要让 `writePage` 抛错，
      那会导致删场景后无法保存。
- [x] 2.3 **辅助线弹层清错场景**：`canvas-settings-popover.tsx:60` 硬编码 `rootIds[0]`，
      多场景下清空的是错的那块。辅助线编辑迁入场景分组后，删除弹层里的辅助线部分。

## 3. Frame 成为真容器

- [x] 3.1 新建 `packages/materials/src/frame/`：`Frame` Component Definition
      （label 场景、`createDefault: createComposeFrame`）与 Inspector，注册进
      `createComposeBuiltinComponentDefinitions`。
- [x] 3.2 场景分组内容：常见尺寸预设 + 辅助线编辑。不含尺寸数值本身，不含背景。
- [x] 3.3 几何 Inspector：`getComposeFrame(entity)` 为真时尺寸模式锁 `fixed`
      （含启用 Auto Layout 的 Frame——`hugAllowed` 当前会误判为 true），
      尺寸提交改派 `BUILTIN_COMMAND_TYPES.setFrameSize`。
- [x] 3.4 组件实例根：`hiddenComponentKeys` 加 `'Frame'`，避免选中实例时冒出场景分组。
- [x] 3.5 单测：Frame 只出现一个尺寸字段；改它同时更新 `Frame.size` 与 LayoutItem 回退；
      Frame 不提供 Hug。

## 4. 编辑器：Inspector 路由与页面配置面板

- [x] 4.1 `controller.tsx`：删除 `selectedFrameId` 分支，Frame 落到普通 `EntityInspector`。
- [x] 4.2 新建 `packages/editor/src/inspector/page-inspector.tsx`：激活场景选择器 +
      `{pageScriptInspector}` + `{animationInspector}`；无页面 props 时回落空态文案。
- [x] 4.3 路由：空选择 → `PageInspector`；多选走空态，并给多选一条区别于单选的提示文案。
- [x] 4.4 动画目标统一锚定 `page.activeFrameId`（四处：自动记录、绑定面板 reference、
      绑定面板 mirror、AnimationInspector）。一页一个激活场景 ⇒ 一条时间线；要动 B 就先激活 B。
- [x] 4.5 stage 的 frame 回退 prop 由 `page.activeFrameId` 提供，不再是 `rootIds[0]`。
- [x] 4.6 `usePageWorkspace.setPageActiveFrame`：仿 `setPageSetupScript`，传
      `session.baseRevision`，成功后回写 session 的 `page`/`baseRevision`（否则下次保存必冲突）；
      失败走 `setPageNotice`，**不做乐观翻转**。
- [x] 4.7 action catalog 新增 `scene.create`（可撤销文档事务，不自动激活）与 `scene.activate`。
- [x] 4.8 删除 `CanvasInspector` 及其 i18n，把尺寸预设相关文案迁进 materials。

## 5. Stage：场景标签与激活边界

- [x] 5.1 `container-labels.ts`：label 模型加 `role: 'scene' | 'container'`（按是否在 `rootIds`）。
- [x] 5.2 `container-label-layer.tsx`：**只有场景标签**改为 flex 行
      `[播放按钮?] [名称按钮] [激活标记]`；普通容器标签与锁定态 `<span>` 逐字节不变。
      `maxWidth` 移到 wrapper，名称按钮 `flex:0 1 auto; min-width:0` 才会收缩并省略号。
- [x] 5.3 testid：`stage-container-label-${id}` 保留在**名称按钮**上（`selectRootFrame`
      与既有 e2e 依赖它，且 Playwright 的中心点点击不能落到 tag 上）；新控件用
      `stage-scene-play-${id}` / `stage-scene-tag-${id}`，不复用容器标签前缀。
- [x] 5.4 双击重命名保护：播放/标记在 `pointerdown` 阶段 `preventDefault + stopPropagation`；
      `lastPointerDownRef` 改为按 entityId 区分（当前是整层共享一个 ref，只靠 5px slop 兜底）。
- [x] 5.5 新 props `onScenePreview` / `onSceneActivate`；wrapper 带 `data-label-entity-id`
      让右键命中——`data-entity-id` 必须唯一指向 Scene 里的那个节点，否则按实体查询 DOM
      的地方会同时命中标签（e2e 里当场撞到过）。
- [x] 5.6 右键菜单「设为激活场景」，已激活时禁用。
- [x] 5.7 激活场景边界 `.is-active` 样式，与 `.is-selected` 正交。
- [x] 5.8 清理死代码：`{kind:'output'}` 命中、`output.select` 效果与不可达分支、
      `onOutputSelect` prop、被丢弃的 `InspectionTarget`。
- [x] 5.9 `resolveActiveFrameId` → `resolveTargetFrameId`（它解析的是**选区所属** Frame，
      与新的「激活场景」不是一回事，同名必然被人传错）；第三个参数改名 `activeFrameId`。

## 6. Preview

- [x] 6.1 预览对话框：二选一 radio 改为场景选择器，默认选中激活场景。
- [x] 6.2 转发 `defaultFrameId`；消除播放宿主与目标解析里的两处 `rootIds[0]` 捷径。
- [x] 6.3 `app/src/StageDemo.tsx` 传 `page.activeFrameId`，并接播放按钮的预览请求。

## 7. 文案与文档

- [x] 7.1 zh 画板→场景、en Frame→Scene：`editor-i18n.ts`、`stage-i18n.ts`、core 默认实体名。
- [x] 7.2 中文注释里的「画板」统一改为「场景」。
- [x] 7.3 `README.md` / `AGENTS.md` / `openspec/project.md`：场景与激活场景术语、
      `ComposePageFile 3`，并写明「协议叫 Frame、界面叫场景」的映射。

## 8. 验证与归档

- [x] 8.1 更新既有 e2e：`editor-workspace`、`animation`、`materials`、`asset-browser`、
      `stage-interactions`、`component-library`、`support/test-helpers.ts`。
      注意页面脚本与动画从 Frame Inspector 搬到了页面配置面板，相关用例要改成点空白工作区。
- [x] 8.2 新增 e2e：
      (a) 新建第二个场景，两块场景各有标签且只有一个是激活标记；
      (b) 点非激活场景标记切换激活，页面配置下拉同步，**`Ctrl+Z` 不回滚激活**；
      (c) 点激活场景播放按钮打开预览且目标正确；
      (d) 点空白工作区出现页面配置，**无尺寸字段**，有动画 + 脚本 + 激活场景；
      (e) 选中场景出现圆角/边框/布局，尺寸字段只有一个且与 `Frame.size` 同步；
      (f) 2.1 的回归以 core 单测覆盖（拖手柄缩放 Frame 同步 Frame.size）；
      (g) 2.2 的回归以 pages 单测覆盖（删掉激活场景后写入仍可重新解析）。
      两者都在对应包里逐条验证过「回退修复即变红」。
- [x] 8.3 黄金图：所有含 Stage 的截图都会多出播放按钮与激活标记，逐张过一遍再更新。
- [x] 8.4 `bun run lint && bun run typecheck && bun run test && bun run build`。
- [x] 8.5 `bun run test:e2e`（改 `app/src` 后必须先确认 build 真的成功，否则测的是旧产物）。
- [x] 8.6 `openspec validate update-frame-to-scene-with-active-target --strict`。
- [x] 8.7 归档并 `openspec validate --all --strict`。

## 已知不在本变更范围

- `openspec/specs/pages/spec.md` 声称存在 PageFile v1→v2 迁移器，代码里只有
  `migrateLegacyComposePageFile`（入参是裸文档）。这是上一条变更留下的规范漂移，
  本变更只新增 v2→v3，不顺手补 v1→v2；若要修正规范表述需另开变更。
- 仓库里还有 5 条已完成未归档的变更；本变更的 stage 侧一律用 ADDED 需求表达，
  刻意不 MODIFY 其中 `add-container-title-and-hit-convergence` 尚未进入 `specs/` 的
  「顶层容器标题标签」，避免归档时静默丢规范。

## 实施记录

- 3.2 场景分组按「常见尺寸预设 + 清空辅助线」落地。逐条辅助线的增删移仍在标尺交互里，
  分组只提供整块清空——这正是从画布设置弹层移除的那个能力，现在按当前 Frame 正确收敛。
- 4.4 自动记录刻意保持按被拖动实体所属 Frame 解析（不是激活场景）：在非激活场景里拖动时，
  `rewriteAutoRecordCommand` 会因该 Frame 清单里没有这条动画而自然 no-op，
  不会写出跨 Frame 的悬空分组。
- 4.7 「新建场景」不自动激活。激活写在页面文件里、不进撤销历史，自动激活会造出
  「撤销后场景已删除但激活仍指向它」的悬空状态。
- 实施中发现的真实约束：激活写的是页面文件，而页面文件里的文档是**上次保存**的那份，
  因此刚新建、尚未保存的场景无法被激活。Store 原本抛「不是根 Frame」，对用户毫无意义；
  改为在 editor 层提前给出可操作的说明。这里不顺手保存文档——保存必须是用户的显式动作。
- 5.9 `resolveActiveFrameId` → `resolveTargetFrameId`，stage prop `defaultFrameId` →
  `activeFrameId`；标签的 `data-entity-id` 改为 `data-label-entity-id`，因为
  `data-entity-id` 必须唯一指向 Scene 里的那个节点。
