# 取消绘图模式

## Why

绘图模式提供了四样东西：命令行、点输入管线、捕捉、八条绘图命令。**没有一样需要「模式」来
承载**——它们都是能力，而能力可以恒开。

模式带来的却是实打实的代价：

- **它和动画互斥，而这没有任何道理。**`setDrafting(mode === 'drafting')` 是三选一切换器的
  直接后果：打开动画就强制关掉绘图。可动画是**另一根轴**——它改的是「拖动的结果落在哪里」，
  与「用什么方式输入」正交。今天想一边看着时间线一边画一根导线，做不到。
- **它把同一件事拆成两套。**画矩形在设计模式是工具栏按钮，在绘图模式是 `RECTANGLE` 命令；
  框选判定在设计模式是用户的设置，进绘图模式被偷偷改成方向敏感；点选在两边一个替换一个累加。
  用户要先想「我在哪个模式」，才能想「我要做什么」。
- **它让能力不可发现。**不进绘图模式，命令行不存在，也就没人知道可以敲 `L`。

同时工具栏上有三个工具位与既有手势完全重复：框选（`select` 在空白处拖拽即框选）、精确移动
（`MOVE` 命令能键入精确位移，严格更强）、平移画布（空格/中键本来就是临时覆盖）。

## What Changes

- **`editor`**：模式切换器三选一 → 两段（设计 / 动画）。`ComposeEditorMode` 去掉
  `'drafting'`，`setDrafting` 连同那条互斥一并删除。
- **`stage`**：绘图能力**恒开**。`drafting` prop 删除；命令行**常驻**；命令等待取点时光标是
  十字，其余时候是常规光标。
- **选择语义只剩一套**：Figma 的替换 + Shift 累加。绘图模式那套「点中即加入」随模式一起删除，
  方向敏感框选不再被模式偷偷打开——判定模式回到用户自己的设置。
- **工具栏**：去掉框选、精确移动、平移画布三个工具位与 `draw-line`。框选**判定模式菜单**
  保留，改挂在 `select` 按钮上——`select` 在空白处拖拽正是框选。
- **`stage-engine`**：`StageInteractionTool` 去掉 `'marquee'`、`'move'`、`'pan'`、
  `'draw-line'` 四个值。
- **`editor`**：`stage.marqueeTool` / `stage.moveTool` / `stage.panTool` /
  `stage.drawLineTool` 四个动作与它们的快捷键一并删除。

**不做**（各有理由，见 design）：绘制工具「同时支持拖与取点」、十字光标的两条偏好、命令词汇
表合并（步骤 7）、物料统一（步骤 8）。

## 判别性用例

**动画开关打开时仍能画线。**今天做不到——切到动画就把绘图强制关掉了，这正是「动画是另一根
轴」这句判断的实证，也是本刀唯一一条既有实现必然红的断言。

## Impact

- Affected specs: `stage`、`stage-engine`、`editor-workspace-layout`
- Affected code：
  - `packages/stage/src/stage-surface/compose-stage.tsx`、`packages/stage/src/styles.css`
  - `packages/stage-engine/src/interaction-controller.ts`、
    `packages/stage-engine/src/interaction-kernel/`（marquee-tool / move-axis / pan 三处 tool 判定）
  - `packages/editor/src/workspace-layout/editor-mode-switcher.tsx`
  - `packages/editor/src/compose-editor/compose-editor.tsx`
  - `packages/editor/src/stage-toolbar/default-stage-toolbar.tsx`
  - `packages/editor/src/editor-controller/action-catalog.ts`、`packages/editor/src/editor-i18n.ts`
- **破坏性**：`StageInteractionTool` 去掉四个值；`ComposeEditorMode` 去掉 `'drafting'`；
  `ComposeStageProps.drafting` 删除；四个 `ComposeEditorShortcutAction` 删除。
  **无文档迁移**——模式与工具都是会话状态，文档里没有它们。用户保存的自定义快捷键若指向被删
  动作，按既有的未知动作处理（忽略该条，不影响其余）。
