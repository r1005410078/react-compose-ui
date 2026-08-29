## ADDED Requirements

### Requirement: CIRCLE 在半径与直径之间切换

`CIRCLE` 取过圆心之后 MUST 提供 `D`（直径）与 `R`（半径）两个关键字，在两种量之间切换。
处于半径档时 MUST 只列出 `D`，处于直径档时 MUST 只列出 `R`——列一个按下去只会把当前状态
再确认一遍的关键字，等于给用户一个没有效果的选项。

切换 MUST 一次改三样：提示文本、这一步的 `fields`（`radius` ↔ `diameter`）与列出的关键字。
少改任何一样，屏幕上都会出现两句互相矛盾的话。

切换 MUST 只作用于**本次会话**，MUST NOT 跨命令记忆。AutoCAD 记住上一次的选择，代价是这条
命令有了一份看不见的状态：用户过两天回来，同一条命令问的问题变了，而屏幕上没有任何东西解释
为什么。每次从半径起步、要直径就打一下 `D`。

直径档下键入的裸数字 MUST 按直径解释：落点在指针方向、距圆心为该值的一半处。

半径为 0 时 MUST 仍以 `rejected` 表达且 MUST NOT 结束会话——两档共用同一条退化判定。

#### Scenario: 切成直径

- **WHEN** `CIRCLE` 取过圆心后键入 `D`
- **THEN** 提示变成「指定直径」，该步的 `fields` 是 `diameter`，列出的关键字变成 `R`

#### Scenario: 切回半径

- **WHEN** 处于直径档时键入 `R`
- **THEN** 提示、`fields` 与关键字都回到半径档

#### Scenario: 直径档下的裸数字按直径解释

- **WHEN** 处于直径档，指针在圆心的某个方向上，用户键入 `300` 并确认
- **THEN** 落地的圆半径是 150

#### Scenario: 下一次 CIRCLE 从半径起步

- **WHEN** 上一次 `CIRCLE` 用过直径档，再次启动 `CIRCLE` 并取过圆心
- **THEN** 提示是半径档

### Requirement: 圆与弧各步声明自己的参数化

`CIRCLE` 与 `ARC` 各步 MUST 按下表声明 `fields` 与 `measured`：

| 命令 | 步 | `fields` | `measured` |
| --- | --- | --- | --- |
| `CIRCLE` | 圆心 | `absolute` | — |
| `CIRCLE` | 半径 / 直径 | `radius` / `diameter` | 画 |
| `ARC` | 起点 | `absolute` | — |
| `ARC` | 途经点 | `polar` | 不画 |
| `ARC` | 端点 | `polar` | 画 |

`ARC` 的两个 `polar` 步 MUST 从**上一个点**起算——第二点从起点，第三点从途经点，与 `LINE`
的「上一个点」是同一条规则。

`ARC` 的途经点步 MUST NOT 打开 `measured`：那一步的预览**就是**那条直线，画两遍就是同一条
线加粗。端点步 MUST 打开：那时预览换成了弧，途经点到落点那一段不在弧上。

`ARC` 取过一个点时的预览 MUST 是一条直线而 MUST NOT 是一段弧。两个点定不出弧，画一段弧要
替用户猜一个半径——用户会以为形状已经定了，而第三个点会把它整个换掉。

`ARC` 的第三步 MUST NOT 显示只读的半径：那一步已经有两个数在跟着光标动，第三个没有输入语义
的数只是噪音。

#### Scenario: 圆的半径步是单字段

- **WHEN** `CIRCLE` 取过圆心
- **THEN** 该步的 `fields` 是 `radius`，且 `measured` 为真

#### Scenario: 弧的两个点只画直线

- **WHEN** `ARC` 取过起点后以候选点查询 `preview`
- **THEN** 返回的几何是一条直线段，不是弧

#### Scenario: 弧的端点步从途经点起算

- **WHEN** `ARC` 取过起点与途经点
- **THEN** 该步的 `fields` 是 `polar`、`measured` 为真，且上报的原点是途经点
