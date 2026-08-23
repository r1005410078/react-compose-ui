## MODIFIED Requirements

### Requirement: 曲线是带盒的普通 Entity

曲线 Entity MUST 保留全部五个必备 Component（Composition、Transform、LayoutItem、
Visibility、Lock），几何 MUST 住在可选的 `Curve` 内建 Component 上，几何点 MUST 使用
盒局部坐标。位置的事实来源 MUST 保持 `LayoutItem.offset`，形状的事实来源是 `Curve`，
盒尺寸是几何的派生（紧包围盒，退化轴钳到 1）。

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
- **THEN** 盒尺寸覆盖该象限点

#### Scenario: 既有直线几何逐字段不变

- **WHEN** 归一化一条既有的直线曲线
- **THEN** 结果与新增 kind 之前一致

### Requirement: 曲线几何经由单一写入漏斗

端点编辑 MUST 通过一条内建命令在同一事务里写入 `Curve` 并重算 `LayoutItem` 的尺寸与
offset，MUST NOT 存在绕开该命令直接写盒或几何的第二个入口。数值 MUST 经
`roundComposeGeometry` 量化。撤销一步 MUST 回到编辑前的几何与盒。

该命令 MUST 覆盖全部 `kind`：弧与多段线的几何写入 MUST 走同一条命令，MUST NOT 各自新开入口。

#### Scenario: 端点编辑同步盒

- **WHEN** 通过命令把线的一个端点移出当前盒
- **THEN** `Curve` 与 `LayoutItem` 在同一事务里更新，盒仍是几何的紧包围盒

#### Scenario: 退化轴不违反盒校验

- **WHEN** 把线编辑成水平线
- **THEN** 盒高钳为 1，文档校验通过，几何点保持精确值

#### Scenario: 撤销一步还原

- **WHEN** 端点编辑后撤销
- **THEN** 几何与盒同时回到编辑前

#### Scenario: 弧与多段线走同一条命令

- **WHEN** 写入一段弧或一条多段线的几何
- **THEN** 使用的是同一条曲线几何写入命令，盒同步为新的紧包围盒
