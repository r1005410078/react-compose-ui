# compose-document 规范增量

## MODIFIED Requirements

### Requirement: 曲线是带盒的普通 Entity

曲线 Entity MUST 保留全部五个必备 Component（Composition、Transform、LayoutItem、
Visibility、Lock），几何 MUST 住在可选的 `Curve` 内建 Component 上，几何点 MUST 使用
**几何空间**坐标。位置的事实来源 MUST 保持 `LayoutItem.offset`，形状的事实来源是 `Curve`，
而**几何空间的范围**是几何的派生（紧包围盒，退化轴钳到 1）。

盒 MUST NOT 再被要求等于紧包围盒：盒由 `LayoutItem` 与布局求解决定，几何按盒与紧包围盒的
比例呈现。创建与绘制路径 MAY 在写入几何的同一个事务里把盒设成紧包围盒，那是**初值**而不是
不变量。

`Curve` MUST 与 Renderer 组合，MUST NOT 与 Hierarchy 组合。`schemaVersion` MUST NOT 因
本能力改变；不含 `Curve` 的既有文档校验结果 MUST 保持不变。

`kind` MUST 支持 `line`、`arc` 与 `polyline`：

- `arc` 由圆心、半径、起始角与**带符号的扫掠角**表达。MUST NOT 另立整圆类型——整圆是扫掠为
  ±360 的弧，否则归一化、平移、距离、特征点、渲染与校验六条路径各要多一份实现。
  MUST NOT 用终止角代替扫掠角：单给终止角分不出 10° 的短弧与 350° 的长弧。
- `polyline` 由顶点序列与 `closed` 布尔表达。MUST NOT 另立矩形类型——矩形是四顶点的闭合
  多段线，它唯一多出来的「四角是直角」在用户拖动某个顶点之后就不再成立。`closed` MUST 是
  布尔而不是「首尾顶点重复」：重复表示法无法区分闭合三角形与回到起点的开放折线，而两者在
  框选与捕捉上给出不同候选。

弧的紧包围盒 MUST 把落在扫掠范围内的**象限点**一并纳入，MUST NOT 只用两个端点：90° 到 270°
的弧鼓出来的那一侧在端点之外，只用端点算会让弧被自己的盒裁掉一块，而这只在跨象限的弧上出现。

新增 `kind` MUST NOT 需要迁移：既有 `line` 文档 MUST 逐字段不变。

#### Scenario: 曲线 Entity 校验通过

- **WHEN** 校验一个带五个必备 Component、Renderer 与合法 `Curve` 的 Entity
- **THEN** 校验通过，`schemaVersion` 仍为 7

#### Scenario: 非法组合被拒绝

- **WHEN** 校验一个 `Curve` 与 Hierarchy 组合、或缺少 Renderer、或几何点非有限数的 Entity
- **THEN** 校验失败并给出稳定机器码

#### Scenario: 既有文档不受影响

- **WHEN** 校验一份不含 `Curve` 的既有 v7 文档
- **THEN** 校验结果与本能力引入前逐字一致

#### Scenario: 整圆表达为扫掠 360 的弧

- **WHEN** 创建一个整圆
- **THEN** 它是 `kind` 为 `arc`、扫掠绝对值为 360 的曲线

#### Scenario: 矩形表达为闭合多段线

- **WHEN** 创建一个矩形
- **THEN** 它是四个顶点、`closed` 为真的 `polyline`

#### Scenario: 跨象限的弧不被盒裁掉

- **WHEN** 归一化一段跨越某个象限点的弧
- **THEN** 几何空间的范围覆盖该象限点

#### Scenario: 既有直线几何逐字段不变

- **WHEN** 归一化一条既有的直线曲线
- **THEN** 结果与新增 kind 之前一致

#### Scenario: 盒与紧包围盒不等时几何不变

- **WHEN** 盒被改成紧包围盒的两倍宽
- **THEN** `Curve` 的几何数值一个都没变

## ADDED Requirements

### Requirement: 盒与几何之间只有一个换算入口

系统 MUST 提供盒 → 几何空间的变换与它的逆，并且 MUST 是**唯一**的换算入口：渲染、命中、
捕捉与几何写入四处 MUST 消费同一份。各自算一遍会让下一个改盒语义的人只改到其中一处，而
漏掉的那处症状是「某些缩放下点不中」——本仓库反复踩到的那一类。

变换 MUST 按轴独立，MUST NOT 只取一个标量：盒可以被非等比地拉伸，强行取单一比例会画出一个
用户从未画过的形状。

几何空间的退化轴 MUST 钳到与 `LayoutItem` 尺寸相同的最小值：水平线的紧包围盒高度是 0，
直接拿来做分母会得到除零，而两处取不同的钳值会让水平线被拉伸一个说不清的比例。

#### Scenario: 非等比盒给出两个不同的轴比例

- **WHEN** 盒的宽是紧包围盒的两倍、高与它相等
- **THEN** 变换在 x 轴的比例是 2，在 y 轴是 1

#### Scenario: 退化轴不除零

- **WHEN** 对一条水平线求变换
- **THEN** y 轴比例是有限数，且钳值与 `LayoutItem` 尺寸用的是同一个常量

#### Scenario: 变换与逆变换互为反函数

- **WHEN** 把一个点变换到几何空间再变换回来
- **THEN** 得到原点（在几何精度内）
