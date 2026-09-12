## ADDED Requirements

### Requirement: 曲线相交与切片住在 core

`core` MUST 在 `curve-geometry.ts` 提供平面形状两两求交：线段 × 线段、线段 × 弧、弧 × 弧。
每个交点 MUST 带上它在两条形状上各自的参数（线段的 `t`、弧的角度），供上层按参数排序。落在
弧扫掠范围之外的候选 MUST NOT 算作交点；平行、共线与同心 MUST 返回空而 MUST NOT 抛错。
它 MUST 与既有平面形状运算同模块——把弧的数学拆到两个包是「一半改了另一半没改」的温床。

`core` MUST 在 `curve.ts` 提供曲线上的**位置**表达与按位置切片：`line` / `polyline` 的位置是
`{ segment, t }`，`arc` 的位置是角度；`sliceComposeCurve(curve, from, to)` MUST 返回被去掉的
那一截与剩下的曲线（零到两条）。切片 MUST 取能表达该几何的**最窄** kind：整圆去掉一截仍是
`arc`（扫掠角缩小）、一段弧被剪中间成两段 `arc`、折线中段去掉成两条 `polyline`、端段去掉即
少一个顶点、只有一段的直线去掉即什么都不剩。

**闭合折线去掉一段即变开放**：`closed` 置 `false`，顶点序列 MUST 从缺口处重排，MUST NOT 凭空
多出重合顶点。`cornerRadius` MUST 原样保留——它只作用于「角」，开放折线的两个端头不是角。
求交与切片 MUST 按**尖角顶点**而 MUST NOT 按圆角后的轮廓：多段线的顶点没有 bulge，落在角弧里的
位置没法落成一个顶点。

`path` MUST NOT 受理切片：它的截要解贝塞尔求交，v1 不做，MUST 以可判别的结果说出来。

#### Scenario: 线段与弧求交

- **WHEN** 一条水平线穿过一个整圆
- **THEN** 得到两个交点，各带线段上的 `t` 与弧上的角度

#### Scenario: 整圆切成弧

- **WHEN** 按两个角度切掉整圆的一截
- **THEN** 剩下一条 `arc`，扫掠角等于 360 减去去掉的那一截

#### Scenario: 矩形去掉一条边

- **WHEN** 按第 `i` 段的两个端点切一条四顶点闭合折线
- **THEN** 剩下一条三段开放折线，顶点从缺口处开始，`cornerRadius` 不变

#### Scenario: 折线中段成两条

- **WHEN** 切掉一条四顶点开放折线中间段的一部分
- **THEN** 剩下两条折线，交点成为各自的新端点

#### Scenario: 单段直线整条去掉

- **WHEN** 切掉一条 `line` 从起点到终点的整截
- **THEN** 剩下零条曲线
