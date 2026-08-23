# 绘图模式的 chrome：共享十字光标与绘图工具栏

## Why

绘图模式的**输入方式**已经齐了——命令行、点输入管线、捕捉、八条命令都在。缺的是**它长什么
样**，而这一层现在自相矛盾：

- **十字光标是重写的简陋版，不是 CAD 那套。**贯穿全屏、没有拾取框、只有一种形态、隐藏系统
  光标只作用于一层。CAD 侧那套（有限长度、拾取框、按 `accepts` 三形态、线在框处断开）是设计
  过的，页面这边没有复用它。两块画布对同一件事给出两种手感，与「特征点捕捉次序两边必须相同」
  是同一类问题。
- **切到绘图模式，工具栏还是设计模式那一套。**选择/框选/移动/缩放/旋转/容器/形状/文字八个
  按钮一个都没换，而绘图模式真正能用的 `LINE ARC CIRCLE RECTANGLE PLINE MOVE COPY ERASE`
  一个都没有。用户只能靠背命令名。模式换掉了输入方式，却没换掉表达输入方式的那块 UI。

顺带把**形状菜单里的「线」**去掉：它与绘图模式的 `LINE` 是真重复，而重构工具栏本来就要改
同一个文件，分两刀等于把这个文件动两遍。

## What Changes

- **`canvas-kit`**：新增共享十字光标组件。输入是一个屏幕点、两个布尔（画不画线 / 画不画框）
  与两个尺寸，**不认识文档、选择集或命令协议**——因此过得了本包那条「它认识文档吗」的准入
  判据，也不撞命中测试 / 场景渲染 / 手势语义三条禁入。
- **`cad-canvas`**：改用共享组件，行为**逐像素不变**。既有 CAD 用例不改一行即全绿是搬运没有
  改变行为的证据。
- **`stage`**：绘图模式的十字光标换成共享组件，因此白拿三形态、拾取框、框处断开与触摸豁免；
  隐藏系统光标的作用域扩到整个图面子树。新增 `ComposeStageHandle.runDraftingCommand` 与
  `onDraftingCommandChange`，让宿主能启动命令并知道现在跑的是哪一条。
- **`editor`**：默认工具栏按 `editorMode` 分流——绘图模式列出八条绘图命令（绘制五条 + 编辑
  三条，用分割线分组），设计模式保持原样。**换掉而不是追加**：两套工具同时摆着会让用户以为
  可以混用。
- **`editor` / `stage` / `stage-engine`**：移除 `draw-line` 工具、`stage.drawLineTool` 动作与
  快捷键、形状菜单里的「线」条目。

**不做**（各有理由，见 design）：去掉形状菜单里的圆与箭头、把绘图工具栏做成可配置插槽、
把 Stage 的绘图会话状态搬去宿主、给十字光标加坐标读数。

## Impact

- Affected specs: `canvas-kit`、`cad-document`、`stage`、`editor-workspace-layout`
- Affected code: `packages/canvas-kit/src/crosshair/`（新）、
  `packages/cad-canvas/src/canvas-surface/cad-surface.tsx`、
  `packages/stage/src/drafting/`、`packages/stage/src/stage-surface/compose-stage.tsx`、
  `packages/stage/src/styles.css`、`packages/editor/src/stage-toolbar/`、
  `packages/editor/src/editor-controller/`、`packages/stage-engine/src/interaction-controller.ts`
- **破坏性**：`StageInteractionTool` 去掉 `'draw-line'`，`ComposeEditorShortcutAction` 去掉
  `'stage.drawLineTool'`。Line **Preset 不删**——既有文档里的 Line Entity 必须继续渲染，
  资源拖入也仍映射得到它。无文档迁移。
