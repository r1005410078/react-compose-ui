# 变更：圆与弧的取点参数化

## 原因

`CIRCLE` 与 `ARC` 今天各步都声明 `polar`，而这对圆是错的：**圆是旋转对称的，半径点的角度
对结果没有任何影响**。屏幕上因此多一个永远不影响结果的数——它占着位置、占着 `Tab` 的一个
去处，却什么也不回答。SDD 初稿写的「半径可编辑、角度只读」正是这条，走一遍交互稿就知道
它是错的。

另一半是画元器件时的实际需要：端子、法兰、轴孔的图纸标注给的是**直径**，今天要用户自己
除以二。

第三条是标注本身的缺陷：`ARC` 的第三步与圆的半径步，标注的两条延伸线从空处伸出来——**被量
的那一段没有画出来**，用户读不出这个数说的是什么。

交互稿：`docs/mockups/drafting-circle-arc.html`，八格已确认。

## 变更内容

- 数值参数化新增 `radius` 与 `diameter` 两种**单字段**种类：`radius` 与 `polar` 的数学逐字
  相同，只呈现第一个字段；`diameter` 是第一个字段乘二的 `polar`。
- 单字段参数化下 `Tab` 不接管、没有锁定这一档——没有第二个字段可去。
- `CIRCLE` 的半径步声明 `radius`，并新增 `D`（直径）/ `R`（半径）关键字在两者之间切换；
  切换只作用于本次会话，**不跨命令记忆**。
- 取点提示可要求「把被量的那一段画出来」：`CIRCLE` 的圆心 → 光标（`D` 时是整条直径）、
  `ARC` 第三步的途经点 → 光标。预览几何已经含这一段的命令（`LINE` / `PLINE` /
  `RECTANGLE` / `ARC` 的第二步）不声明它。
- 直径的数值框带 `⌀` 前缀。

## 影响

- 受影响的规范：`compose-document`、`commands`、`stage-engine`、`stage`
- 受影响的代码：
  - `packages/core/src/point-input/point-fields.ts`
  - `packages/commands/src/command/command-types.ts`
  - `packages/stage-engine/src/drafting/shape-commands.ts`、`drafting-types.ts`
  - `packages/stage/src/drafting/dynamic-input/`、`stage-i18n.ts`
