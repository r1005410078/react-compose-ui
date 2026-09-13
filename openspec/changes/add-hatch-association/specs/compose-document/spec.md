## MODIFIED Requirements

### Requirement: 填充是一个可选 Entity Component

`core` MUST 提供可选 Entity Component `Hatch`，有两个字段：

- `seed`——这块面的**锚点**，**Entity 局部坐标**，与 `Ports.position`、`Curve` 的盒局部几何
  同一个空间。求解 MUST 从这一点出发。
- `boundaryIds`——**可选**，围出这块面的那几个 Entity 的 id。**缺席 MUST 表示不跟随**。

`Hatch` 缺席 MUST 表示「这不是一块由求面产出的填充」，与 `Wire` 缺席即不是导线同一条。

几何的事实来源仍然 MUST 是 `Curve`：填充落地之后就是一条普通的闭合多段线或 `path`，
选中、resize、顶点编辑、场景树与撤销全部照常。

`Hatch` MUST NOT 存**边**级引用（某条边是与哪个对象的第几个交点，或用到了哪几段）：
一条直线穿过一个圆有两个交点，选哪一个是个启发式；而段下标在顶点被增删之后就错位。
`boundaryIds` 是 **Entity 级**的，它不回答「第几个交点」，只回答「围出这块面的是哪几个对象」,
因此不受这条禁令约束。

`Hatch` MUST NOT 存烘死的环几何——`Curve` 就是那份几何，存第二份等于给同一个形状造两个事实
来源，与导线「自由端 MUST NOT 存坐标」是同一条判断。

`Hatch` MUST 与 `Curve` 组合。两个字段都是可选新增或既有字段，因此协议版本**不变**，
既有文档 MUST 逐像素不变、不需要迁移。

#### Scenario: 缺席时与本要求引入之前一致

- **WHEN** 一个 Entity 没有 `Hatch`
- **THEN** 它的校验、渲染与命中与本要求引入之前完全一致

#### Scenario: seed 跟着 Entity 走

- **WHEN** 一个带 `Hatch` 的 Entity 被移动
- **THEN** `seed` 不变——它是 Entity 局部坐标，因此表达的仍是同一个位置

#### Scenario: 不带 Curve 的 Hatch 非法

- **WHEN** 一个 Entity 有 `Hatch` 而没有 `Curve`
- **THEN** 文档校验拒绝

#### Scenario: 没有边界清单的填充不跟随

- **WHEN** 一个带 `Hatch` 的 Entity 没有 `boundaryIds`
- **THEN** 它不参与自动跟随，行为与本变更引入之前逐字相同

#### Scenario: 空的边界清单非法

- **WHEN** `boundaryIds` 存在但是空数组
- **THEN** 文档校验拒绝——不围出任何东西的清单读不出意图，不再需要时删掉整个字段

## ADDED Requirements

### Requirement: 求出一块面的最大内切圆圆心

`core` MUST 提供纯函数，求出一块面的**最大内切圆圆心**——离每一条边界都尽可能远的那个点。

它 MUST 把带洞的面一并算进去：洞的边界同样是边界，落在洞里的点 MUST NOT 被选中。
弧边 MUST 按固定份数采样成折线——本函数**只用来选一个点，不产出任何几何**，
因此这处近似不违反「这块画布上每条几何都是真几何」。

结果 MUST 落在这块面的内部。面退化到没有内部时 MUST 返回缺席，由调用方决定怎么办。

#### Scenario: 矩形的圆心在正中

- **WHEN** 对一个矩形求最大内切圆圆心
- **THEN** 结果是它的中心

#### Scenario: 洞把圆心推开

- **WHEN** 一块面的正中有一个洞
- **THEN** 结果落在洞之外，且不在洞里

#### Scenario: 结果恒在面内

- **WHEN** 对一块凹多边形（L 形）求最大内切圆圆心
- **THEN** 结果落在这块面的内部，而不是它包围盒的中心

#### Scenario: 退化的面返回缺席

- **WHEN** 一块面已经没有内部（面积为零）
- **THEN** 返回缺席，而不是返回一个落在边界上的点
