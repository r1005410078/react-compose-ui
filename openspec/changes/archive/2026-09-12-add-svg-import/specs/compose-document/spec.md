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

`kind` MUST 支持 `line`、`arc`、`polyline` 与 `path`：

- `arc` 由圆心、半径、起始角与**带符号的扫掠角**表达。MUST NOT 另立整圆类型——整圆是扫掠为
  ±360 的弧，否则归一化、平移、距离、特征点、渲染与校验六条路径各要多一份实现。
  MUST NOT 用终止角代替扫掠角：单给终止角分不出 10° 的短弧与 350° 的长弧。
- `polyline` 由顶点序列与 `closed` 布尔表达。MUST NOT 另立矩形类型——矩形是四顶点的闭合
  多段线，它唯一多出来的「四角是直角」在用户拖动某个顶点之后就不再成立。`closed` MUST 是
  布尔而不是「首尾顶点重复」：重复表示法无法区分闭合三角形与回到起点的开放折线，而两者在
  框选与捕捉上给出不同候选。
- `path` 由**子路径序列**与可选的 `fillRule` 表达。每条子路径是一个起点、一列**三次贝塞尔**
  段与一个 `closed` 布尔。

`path` 的段 MUST 全部是三次贝塞尔，直线段 MUST 规范化成控制点落在段上的三次段，
MUST NOT 另立段类型：多一种段类型就是让归一化、平移、距离、包围盒、渲染与校验六条路径各多
一支，这与「整圆是扫掠 ±360 的弧」「矩形是四顶点的闭合多段线」是同一条判断。

`path` MUST 携带子路径而不是被拆成多个 Entity：一个带洞的图形是**一条**路径的两条子路径加
`evenodd`，拆开会把洞画成一块实心的覆盖物。

`fillRule` **缺席即 `nonzero`**，`nonzero` MUST NOT 写成显式值——缺席与显式是同一件事，留两种
表示会让「填充规则是什么」在两处读出不同答案，这与 `cornerRadius` 归零时删掉字段是同一条判断，
也让本字段不需要迁移。

写入方 MUST 取能表达该几何的**最窄** kind：能用 `line`、`arc` 或 `polyline` 表达的几何
MUST NOT 落成 `path`。`path` 没有夹点，落错 kind 的症状是「这条线看起来一样却拖不动顶点」。

弧的紧包围盒 MUST 把落在扫掠范围内的**象限点**一并纳入，MUST NOT 只用两个端点：90° 到 270°
的弧鼓出来的那一侧在端点之外，只用端点算会让弧被自己的盒裁掉一块，而这只在跨象限的弧上出现。

同理，贝塞尔段的紧包围盒 MUST 由导数为零处的**极值点**求得，MUST NOT 取控制点凸包：凸包是
紧包围盒的超集，在 S 形段上肉眼可见地大一圈，盒会宣称对象并不占据的面积。这是象限点那条
规则的同一个应用。

新增 `kind` MUST NOT 需要迁移：既有 `line`、`arc` 与 `polyline` 文档 MUST 逐字段不变。

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

#### Scenario: 贝塞尔的盒不被控制点撑大

- **WHEN** 归一化一段控制点远在曲线之外的三次贝塞尔
- **THEN** 几何空间的范围是曲线自身的紧包围盒，而不是控制点凸包

#### Scenario: 缺席的 fillRule 不被写成显式值

- **WHEN** 写入一条填充规则为非零绕数的 `path`
- **THEN** `fillRule` 字段缺席

#### Scenario: 既有直线几何逐字段不变

- **WHEN** 归一化一条既有的直线曲线
- **THEN** 结果与新增 kind 之前一致

#### Scenario: 盒与紧包围盒不等时几何不变

- **WHEN** 盒被改成紧包围盒的两倍宽
- **THEN** `Curve` 的几何数值一个都没变

#### Scenario: 贝塞尔在非等比盒里精确投影

- **WHEN** 把一条 `path` 投影进一个宽高比与紧包围盒不同的盒
- **THEN** 控制点按仿射映射精确变换，MUST NOT 像弧那样退化成多段线

### Requirement: 点在曲线内部的判定

`core` MUST 提供「一个点是否落在曲线几何内部」的判定，作为**唯一**入口供命中路径调用。
判定 MUST 把几何拍平成顶点序列后求解，弧 MUST 复用既有的弧拍平函数、贝塞尔 MUST 复用同一族的
拍平函数——第二份弧数学或第二份贝塞尔数学正是「一半改了另一半没改」的温床。

判定 MUST 按 `fillRule` 分派：缺席时按**非零绕数**，`evenodd` 时按奇偶。缺席即非零绕数
与 SVG 的默认值一致，渲染与命中因此读出同一个答案。

对单条**不自交**的轮廓两条规则给出相同答案，因此既有的 `line`、`arc` 与不自交 `polyline`
的判定结果 MUST 逐点不变。**自交轮廓上两者不同**（一笔画出来的五角星，星心在非零绕数下是
内部、在奇偶下不是），而此前这里写死奇偶、渲染却按 SVG 的默认非零绕数填充——星心是**画着
实心却点不中**的。改成两处读同一条规则顺带修掉了它，这处行为变化是有意的。

判定 MUST NOT 前置检查 `closed`：开放几何按**隐式闭合**处理，与 SVG 填充开放几何的规则相同，
渲染与命中因此自动一致，不需要在两处各写一遍「什么算封闭」。

判定的输入 MUST 是已经投影进盒坐标系的几何，MUST NOT 自己再做一次盒到几何的换算——那个换算
只有一个入口。

#### Scenario: 闭合多段线内部

- **WHEN** 判定一个点是否落在闭合四顶点多段线内部
- **THEN** 内部的点为真，外部的点为假

#### Scenario: 整圆内部

- **WHEN** 判定圆心是否落在扫掠 360 的弧内部
- **THEN** 为真

#### Scenario: 开放几何按隐式闭合

- **WHEN** 判定一个点是否落在开放三顶点多段线的首尾连线围出的区域内
- **THEN** 为真，与 SVG 填充该多段线时画出的区域一致

#### Scenario: 直线没有内部

- **WHEN** 判定任意点是否落在两点直线内部
- **THEN** 为假

#### Scenario: evenodd 的洞不算内部

- **WHEN** 判定一个点是否落在 `fillRule` 为 `evenodd`、含两条同心子路径的 `path` 的内圈里
- **THEN** 为假

#### Scenario: 不自交的既有曲线判定不变

- **WHEN** 判定既有不自交 `polyline` 与 `arc` 上的任意点
- **THEN** 结果与本变更前逐点一致

#### Scenario: 自交轮廓与渲染对齐

- **WHEN** 判定一笔画出来的五角星的星心
- **THEN** 为真，与 SVG 按默认非零绕数填出来的墨一致
