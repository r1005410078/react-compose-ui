# 变更：导线与箭头画完一条接着画下一条

## 原因

接线是**成批**的活儿：一张接线图上连二三十条，中间不该被打断。今天每条导线画完命令就结束，
要重新按一次 `W`（或按 `Enter` 重复，见 `add-surface-enter-repeats-command`）。

调研过的 EDA 工具在这一点上是一致的——KiCad、Altium、Visio 的连线工具画完一条**保持激活**，
`Esc` 才退出；Fusion / Onshape 的直线工具同理。AutoCAD 相反（命令结束、`Enter` 重复），但它是
通用绘图：画一个东西然后去调它。**分野不在谁抄谁，而在这个工具是干什么的。**

## 变更内容

- `ComposeCommandDefinition` 新增可选 `repeat`：提交之后立刻以同一条命令重开一次会话。
- `WIRE` 与 `ARROW` 声明它；`RECTANGLE` / `CIRCLE` / `ARC` / `LINE` / `PLINE` 不声明。
  判据是既有那条——**用户画完之后想对它做什么**。
- 重启的是一条**全新**会话：不继承上一条的任何点，因此不会退化成链。
- `Escape` 在会重启的命令里分两级：当前这一条已经取过点就放弃这一条、命令留着；一个点都没取
  才退出命令。

## 影响

- 受影响的规范：`commands`、`stage-engine`、`stage`
- 受影响的代码：
  - `packages/commands/src/command/command-types.ts`
  - `packages/stage-engine/src/drafting/line-command.ts`
  - `packages/stage/src/drafting/use-stage-drafting.ts`
- 依赖：`add-surface-enter-repeats-command` 不是前置，但两者一起才让「接着画」在键盘与鼠标
  两条路上都成立。
