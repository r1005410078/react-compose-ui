# 变更：TRIM 命令——一下点掉光标底下的那一截

## 原因

接线图上最常做的修形动作是「去掉一截」：母线被一排支路穿过要断开其中一格、外框的一条边要
让给符号、一条线画过头了要缩回到交点。今天这件事没有入口——点选删的是整个 Entity，顶点模式
的段夹点 `Delete` 只对导线成立、且只认拐点不认交点，而一条被三条竖线穿过的横线一个拐点都
没有。用户能做的是删掉整条线再画三段，而那三段的端点要一个一个吸回去。

调研过的产品里「剪刀」是三件不同的事：**去掉一截**（AutoCAD `TRIM` 的 Quick 模式、Fusion 360
Sketch Trim、Sketch 的 Scissors）、**在一点剪开**（Illustrator Scissors、AutoCAD `BREAK`）、
**拿刀划开实心形状**（Knife）。我们要的是第一件：在一点剪开产出两个重合端点，屏幕上与没剪之前
逐像素相同，那正是导线剪断设计里否掉的假接头；刀面向填色图形，而这里的图形绝大多数是空心线框。
共有的性质只有一条——**用户指着的是屏幕上的一截，不是一个点、也不是一个对象**。CAD 的边界是
交点、Sketch 的边界是顶点；接线图上两者都有，因此边界取两者的并集。

设计稿：`docs/mockups/drafting-trim.html`。

## 变更内容

- **新增 `TRIM` 命令**（别名 `TR`，编辑分组，不给单键——`T` 已归文字工具，与 `POLYGON` 同一条）。
  光标落在哪一截就去掉哪一截：从落点向两边走，遇到第一个**交点或顶点**就停，没有就到端头。
  图上所有曲线自动是切割边，不用先选。悬停即预览（那一截淡成幽灵、两头各画一道剪口），点下即
  落地一个事务，会话留着继续剪下一截；按住拖过多条，轨迹碰到的每一截一起去掉、一个事务。
- **`commands` 包新增 `pick` 输入种类**：一个落在对象上的点。它既不是 `point`（不过点输入管线
  ——吸附会把落点挪到光标底下那一截之外）也不是 `selection`（不改选择集，且要知道落在**哪儿**）。
  提示可声明一枚光标徽标（`badge: 'scissors'`），由提示自己声明而不由宿主按命令 id 反推。
- **`core` 新增曲线相交与切片**：线段、弧两两求交，以及按曲线自身参数切出一截。住在
  `curve-geometry.ts` / `curve.ts`，与既有平面形状运算同模块。
- **剪断规划推广到所有曲线**：`planStageWireCut` 的「只对导线成立」放宽——中间段分两条、闭合变
  开放、端段与唯一一段仍拒绝；`wire` 判据只决定绑定怎么继承。顶点模式里**普通折线的段夹点**
  `Delete` 因此也有了答案，它是 `TRIM` 在「这一段上没有交点」时的退化情形。
- **十字光标多一档**：等待 `pick` 时画拾取框加剪刀徽标，不画十字线；徽标由画拾取框的那一层
  一起画，系统光标的隐藏仍然只有一个来源。
- **绘图货架**加 `TRIM` 一格（排在八条绘图命令之后、文字之前）；页面货架不加，命令行照常可用。
- **拒绝并说明**：锁定、接线点（`resize: 'none'`）、非曲线、`path`（贝塞尔，v1 不做）四句互不相同。

## 影响

- 受影响的规范：`commands`（`pick` 输入种类、光标徽标）、`compose-document`（曲线相交与切片）、
  `stage-engine`（`TRIM` 命令与截的解算、剪断推广、顶点模式段夹点）、`stage`（悬停预览与拖动、
  十字光标、顶点模式 `Delete` 表）、`editor-workspace-layout`（绘图货架）
- 受影响的代码：
  - `packages/commands/src/command/command-types.ts`（`pick` 输入种类、`badge`）
  - `packages/core/src/curve-geometry.ts`（线段 × 线段、线段 × 弧、弧 × 弧求交）
  - `packages/core/src/curve.ts`（曲线位置参数、按位置切片）
  - `packages/stage-engine/src/drafting/trim-command.ts`（新：会话与定义）
  - `packages/stage-engine/src/commands/curve-trim.ts`（新：截的解算与规划）
  - `packages/stage-engine/src/commands/wire-cut.ts`（放宽为所有曲线）
  - `packages/stage-engine/src/geometry-editing/vertex-edits.ts`（段夹点不再按 `wire` 门禁）
  - `packages/stage-engine/src/drafting/drafting-edits.ts`（`trim` 效果 → 命令）
  - `packages/stage/src/drafting/use-stage-drafting.ts`（`pick` 的命中、悬停预览、拖动轨迹）
  - `packages/stage/src/drafting/stage-drafting-overlay.tsx`（幽灵、剪口、轨迹、徽标）
  - `packages/stage/src/stage-surface/compose-stage.tsx`（十字光标的 `pick` 档）
  - `packages/stage/src/stage-i18n.ts`（提示与四句拒绝）
  - `packages/editor/src/stage-toolbar/toolbar-shelf.ts`（目录与绘图货架）
- 不受影响：`Curve` / `Wire` / `Ports` 协议与版本号，`entity.curve.set` 的载荷语义，导线求解，
  节点接入与合并（`TRIM` 剪到节点时既有的支路清理与合并在同一个事务里照常发生）。
