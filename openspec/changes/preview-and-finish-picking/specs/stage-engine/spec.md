# Stage Engine 规范增量

## MODIFIED Requirements

### Requirement: 绘图命令复用泛型命令引擎

绘图命令 MUST 复用 `@compose-ui/commands` 的命令定义、别名解析与四态推进
（`prompt` / `commit` / `cancelled` / `rejected`），MUST NOT 另实现一套命令会话。
Stage 侧只声明自己的上下文与效果类型。

`LINE`（别名 `L`）MUST 连续画线：每取到一个新点即产出一段已落地的线，会话继续等待下一点，
直到用户显式结束。非法输入 MUST 以 `rejected` 表达且 MUST NOT 结束会话——点错、打错关键字
在这类工具里是常态，结束命令会让用户从头再来。

**连续取点的命令（`LINE` 与 `PLINE`）的「下一点」提示 MUST 说明回车结束。**AutoCAD 的提示
不写这一句，因为它的用户知道；本产品的用户不知道，而命令行是这条能力唯一的说明书。结束
MUST NOT 做成关键字：那会与「空 Enter 即 accept」形成同一件事的第二个入口。

取够点自己就提交的命令（`RECTANGLE` / `CIRCLE` / `ARC` / `ARROW` / `WIRE`）MUST NOT 带这句
提示——它们没有「怎么结束」这个问题。

**产出几何的命令 MUST 实现 `preview(point)`**，返回「这一步如果落在那里」的效果，其中含**到
目前为止加上这个候选点**的完整几何。`PLINE` 取过三点时 MUST 返回四个顶点而不是最后那一段，
`RECTANGLE` MUST 返回闭合四顶点而不是对角线，`CIRCLE` MUST 返回整圆而不是半径线。

形状 MUST 由会话给出而 MUST NOT 由宿主推导：两个对角点怎么变四个顶点、圆心加半径点怎么变整圆
只有命令知道，让宿主算等于让它认识每一条命令。

不产出几何的命令（`MOVE` / `COPY` / `ERASE` / `VERTEX`）MUST NOT 实现它——它们那一步没有形状
可言，位移由橡皮筋表达。

命令集 MUST 另含 `ARC`、`CIRCLE`、`REC`、`PLINE` 与 `ARROW`：

- `ARC` 取起点、途经点与终点；三点共线时 MUST 以 `rejected` 表达且 MUST NOT 结束会话。
- `CIRCLE` 取圆心与半径点，产出扫掠为 360 的弧。
- `REC` 取两个对角点，产出四顶点的闭合多段线。
- `PLINE` 连续取点，但 MUST 攒成**一个** Entity 在结束时提交——这正是它与 `LINE` 存在差别的
  理由。因此 `PLINE` MUST 提供「放弃上一点」关键字而 `LINE` MUST NOT：`LINE` 的放弃等于一次
  文档撤销，`PLINE` 的还在会话里。
- `ARROW`（别名 `AR`）取两个点，产出一条带终点箭头的曲线。它 MUST 取两点就结束而 MUST NOT
  像 `LINE` 那样连着画：**一支箭头只有一个头**，连着画会得到一串各自带头的箭头，而那不是
  任何人启动这条命令时想要的东西。

`ARROW` 与 `WIRE` MUST 共用同一个两点会话工厂，差别只在提交效果上的那一个标记：两者的取点
逻辑逐字相同，复制一份只会让下一个改取点的人改到其中一处。

引擎 MUST NOT 认识 Renderer props 或 Preset id：`ARROW` 只在效果上给出「这是一支箭头」的
标记，由持有 Registry 的宿主挑那个带终点箭头的 Preset——这与 `WIRE` 的 `wire` 标记是同一条
既有边界。

`PLINE` 被取消时 MUST 什么都不提交。这一条 MUST NOT 因为「代价太大」而改成提交：`Escape` 的
含义是放弃这条命令，而画错一半想扔掉比画完更常见；代价可接受的前提是**结束容易**，那由回车、
右键与提示里的那句话共同承担。

#### Scenario: 连续画线逐段落地

- **WHEN** 启动 `LINE` 后依次取三个点
- **THEN** 产出两段线，且会话在第三点之后仍在等待下一点

#### Scenario: 非法输入不结束会话

- **WHEN** 命令进行中键入既不是坐标也不是关键字的文本
- **THEN** 会话给出被拒绝的说明并停在原提示

#### Scenario: 显式结束

- **WHEN** 用户在命令进行中中止
- **THEN** 会话结束，已落地的线段保留

#### Scenario: 多段线攒成一个 Entity

- **WHEN** 启动 `PLINE` 后依次取四个点并结束
- **THEN** 只产出一个 Entity，其几何含四个顶点

#### Scenario: 多段线可放弃上一点

- **WHEN** `PLINE` 取到第三点后键入放弃关键字
- **THEN** 顶点回到两个，会话继续等待下一点，且此时尚未产生任何文档事务

#### Scenario: 三点共线的弧被拒绝

- **WHEN** `ARC` 的三个点共线
- **THEN** 会话给出被拒绝的说明并停在原提示

#### Scenario: 箭头取两点即结束

- **WHEN** 启动 `ARROW` 后取两个点
- **THEN** 产出一条带终点箭头的曲线，且会话结束

#### Scenario: 连续取点的提示说出怎么结束

- **WHEN** `PLINE` 取到第一个点
- **THEN** 提示在「指定下一点」之外说明回车结束

#### Scenario: 预览含已取的全部点

- **WHEN** `PLINE` 取过三个点后以第四个候选点查询 `preview`
- **THEN** 返回的几何有四个顶点

#### Scenario: 预览是形状而不是橡皮筋

- **WHEN** `RECTANGLE` 取过一个角点后以对角候选点查询 `preview`
- **THEN** 返回的几何是闭合的四顶点多段线

#### Scenario: 查询不推进会话

- **WHEN** 对同一条会话连续查询 `preview` 若干次
- **THEN** 会话的提示与随后 `advance` 的结果与从未查询过时完全一致
