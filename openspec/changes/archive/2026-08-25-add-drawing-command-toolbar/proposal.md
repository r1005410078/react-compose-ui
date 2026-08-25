# 绘图命令上工具栏

## Why

十条命令（`LINE` / `PLINE` / `RECTANGLE` / `CIRCLE` / `ARC` / `WIRE` / `MOVE` / `COPY` /
`ERASE` / `VERTEX`）今天**只能靠敲名字发现**。用户第一次打开编辑器时，看得见的绘图入口只有
一个形状 split button（矩形 / 箭头 / 圆），而它们走的是**另一套机制**。

AutoCAD 的 Draw 面板正是这批命令的图形入口：按钮按下去等于敲那个词，之后照常取点。

## 一个必须先解决的矛盾：不能只是「加一排」

`RECTANGLE` 与 `CIRCLE` **已经有图形入口**了——`draw-rectangle` / `draw-circle` 工具。再给它们
加一个命令按钮，就正好复现路线图里列为「绘图模式三样代价」之一的那一条：

> 把同一件事拆成两套（矩形在一边是工具栏按钮、在另一边是 `RECTANGLE` 命令）

而且这次更糟——它会让一处**已知的仲裁器冲突变得用鼠标就能触发**：绘制工具武装着、又点了命令
按钮时，取点插件（`drafting-point`，1650）在 `pointerdown` 就把手势吃掉，`draw`（1000）永远
起不来，拖动没有反应。AGENTS.md 记着这条，前提是「两者同时武装」——今天要靠先点工具再敲命令
才能凑出来，加了按钮之后**两下鼠标就能到**。

**因此是替换，不是新增。**形状 split button 删除，绘图入口收敛成一套：命令。

## What Changes

### 工具栏

- 新增**绘图命令组**：`LINE`、`PLINE`、`RECTANGLE`、`CIRCLE`、`ARC`、`ARROW`、`WIRE` 七个按钮。
  按下去与在命令行敲那个词**完全等价**——启动的是同一条会话，不是并行的第二条路径。
- **删除形状 split button**（`draw-rectangle` / `draw-arrow` / `draw-circle` 三个工具值）。
- `draw-container` 与 `draw-text` **不动**：它们不是制图几何，也没有对应命令。

### 新增一条 `ARROW` 命令

`draw-arrow` 是唯一没有命令等价物的绘制工具（箭头 = 带 `markerEnd` 的曲线）。删掉工具之前先补
上这个词，否则能力真的少了一块。

这**不违反**「已经有等价画布命令的动作不再造第二个词」——那条挡的是重复，而箭头今天没有任何
命令表达得了。

### 宿主启动命令的入口

工具栏住在 `editor`，命令会话住在 `stage` 自己（命令行由 Stage 渲染，这条边界不动）。今天
**没有**从宿主启动一条会话的通道——工具栏上的捕捉开关写的是文档字段 `canvas.grid.snapEnabled`，
不是 Stage 会话，因此不能当先例。

新增一个 Stage 命令式句柄：

```ts
export interface ComposeStageHandle {
  /** 启动一条命令会话，与在命令行敲下它的名字完全等价。 */
  startCommand(commandId: string): void
}
```

并由 `onActiveCommandChange` 上报当前会话的命令 id，按钮据此显示按下态——AutoCAD 的 ribbon
按钮在命令进行期间同样是高亮的，而命令行提示只在图面下方，不在用户点击的那个位置。

## Impact

- Specs：`stage`（两条 MODIFIED、一条 ADDED）、`editor-workspace-layout`（一条 MODIFIED）
- 代码：`packages/stage-engine`（`ARROW` 命令）、`packages/stage`（句柄与上报）、
  `packages/editor`（工具栏、三个新图标、文案）
- **删除**：`draw-rectangle` / `draw-arrow` / `draw-circle` 三个工具值及其键位与图标引用
- 文档零改动

## 明确不做

**编辑命令（`MOVE` / `COPY` / `ERASE` / `VERTEX`）不上工具栏。**AutoCAD 把它们放在 Modify
面板，是一个独立分组；而这一刀要先证明「按钮启动命令」这条通道是对的。四个词各自还有键盘入口
（`ERASE` 有 Delete，`VERTEX` 有双击），绘图七个词则**只有敲名字**这一条路——先补最缺的那一半。
