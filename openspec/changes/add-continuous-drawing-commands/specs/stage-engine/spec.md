## ADDED Requirements

### Requirement: 成批作业的命令提交后接着画

`WIRE` 与 `ARROW` MUST 声明 `repeat`；`LINE` / `PLINE` / `RECTANGLE` / `CIRCLE` / `ARC`
MUST NOT 声明。

判据是既有那条——**用户画完之后想对它做什么**（当初判定 `RECTANGLE` 该产出矩形物料的同一条）：

- 导线与箭头画完，九成是接下一条。接线是**成批**的活儿，一张图上连二三十条。
- 矩形、圆、弧画完，九成是填色、调圆角、往里塞东西。

这个不对称是**设计**。反证：给所有命令都重开，画完一个矩形想调它得先按一次 `Escape`，而那一下
按键不携带任何信息——正是这套交互从一开始就在删的东西。

`LINE` 与 `PLINE` 本来就连续取点，重开对它们没有意义。

#### Scenario: 导线声明重开

- **WHEN** 查阅 `WIRE` 与 `ARROW` 的命令定义
- **THEN** 两者的 `repeat` 都为真

#### Scenario: 取够即结束的形状命令不声明

- **WHEN** 查阅 `RECTANGLE` / `CIRCLE` / `ARC` 的命令定义
- **THEN** 三者都不声明 `repeat`
