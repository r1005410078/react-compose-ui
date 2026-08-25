# Stage Engine 规范增量

## MODIFIED Requirements

### Requirement: 绘图命令复用泛型命令引擎

绘图命令 MUST 复用 `@compose-ui/commands` 的命令定义、别名解析与四态推进
（`prompt` / `commit` / `cancelled` / `rejected`），MUST NOT 另实现一套命令会话。
Stage 侧只声明自己的上下文与效果类型。

`LINE`（别名 `L`）MUST 连续画线：每取到一个新点即产出一段已落地的线，会话继续等待下一点，
直到用户显式结束。非法输入 MUST 以 `rejected` 表达且 MUST NOT 结束会话——点错、打错关键字
在这类工具里是常态，结束命令会让用户从头再来。

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
