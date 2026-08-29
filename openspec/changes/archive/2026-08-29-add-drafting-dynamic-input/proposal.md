# 变更：绘图取点的动态输入

## 原因

取点全程屏幕上**一个数字都没有**——拖容器时那个「248 × 144」只服务 `draw-container` 拖拽，
命令取点没接。这是「画元器件不方便」最直接的一半，也是 `todo` 第 4 条。

同时，键入一个裸数字今天会被三条坐标正则全部拒掉（`x,y` 要逗号、`@dx,dy` 要 `@`、
`距离<角度` 要 `<`），落到关键字分支被拒——而「方向由鼠标定好、只打一个长度」正是画元器件时
最高频的输入方式。

SDD 2.4 / 2.5 已确认交互与视觉，两份交互稿逐点量过。

## 变更内容

- `ComposeCommandPrompt` 新增可选 `fields`：这一步的数值参数化（`absolute` / `polar` /
  `cartesian`）。可选，既有命令不受影响。
- `@compose-ui/core` 新增字段正反算：落点 ↔ 两个数值字段，以及「把某一个字段替换成键入值、
  另一个保持不变」。
- Stage 在光标旁画出这一步的两个数值与它们的标注（长度标注线 + 角度弧 / 宽高两条边长标注），
  几何按交互稿。
- 命令行成为动态输入的**输入端**：键入的裸数字进当前活动字段，`Tab` 锁定当前字段并切到另一个，
  锁定的字段不再跟光标。
- 各绘图命令声明自己的字段：第一个点 `absolute`，`RECTANGLE` 的对角点 `cartesian`，其余 `polar`。

## 影响

- 受影响的规范：`commands`、`compose-document`、`stage`、`components`
- 受影响的代码：
  - `packages/commands/src/command/command-types.ts`
  - `packages/core/src/point-input/`
  - `packages/stage-engine/src/drafting/`
  - `packages/components/src/command-line/`
  - `packages/stage/src/drafting/`
