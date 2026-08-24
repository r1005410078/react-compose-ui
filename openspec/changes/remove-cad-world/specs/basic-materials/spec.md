## ADDED Requirements

### Requirement: 曲线的虚线偏移

Curve Renderer MUST 提供 `strokeDashoffset` 数值 prop，默认 `0`，缺席时 MUST NOT 产生任何
偏移——不写该 prop 的曲线渲染输出 MUST 与引入本属性之前逐像素一致。

该属性 MUST 走 Renderer props 而不是 `Curve` Component：它只有渲染与 Inspector 读，因此
沿用既有描边属性的归属，白拿数据绑定与外观关键帧轨道。轨道路径
`['Renderer','props','strokeDashoffset']` MUST NOT 需要动画引擎或文档协议的任何改动——
采样器按 `[componentKey, ...rest]` 写值。

本属性是「让导线看起来在流动」的**唯一**机制：系统 MUST NOT 为此引入命令或预设动画。
自动算出一个完整虚线周期需要 dash pattern 的世界长度，而当前的 `strokeDasharray` 是由线宽
推出的 picklist，正处于已立项的单位错配之中；把周期算进命令语义会把该缺陷固化。

打点入口 MUST 与其他可动画属性一致：Renderer 分组的字段 MUST 能拿到关键帧装饰，自动记录
MUST 认得 Renderer props 的编辑并改写成播放头处的关键帧。缺任一处，该属性就是一个用户永远
打不了点的属性——**「加了一个属性」与「加了一个能力」之间隔着 UI 的三段接线**。

Renderer props 是**开放**记录（每个物料自定义），因此自动记录 MUST 按白名单逐条放行，
MUST NOT 采用 `Appearance` 那条「除了这几个字段之外都不许变」的规则——那会把每一次普通的
props 编辑都判成不可改写。

#### Scenario: 缺席即不偏移

- **WHEN** 一条曲线的 Renderer props 不含 `strokeDashoffset`
- **THEN** 渲染输出不含该属性，与引入前一致

#### Scenario: 偏移随关键帧变化

- **WHEN** 为一条虚线曲线的 `['Renderer','props','strokeDashoffset']` 打两个关键帧并播放
- **THEN** 虚线图案沿线移动，中间时刻取到的是插值出来的第三个值
- **AND** 几何、命中与捕捉都不受影响

#### Scenario: 动画模式下改值进关键帧而不是静态值

- **WHEN** 动画模式开着自动记录，用户在属性面板把虚线偏移改成另一个值
- **THEN** 播放头处产生一个关键帧
- **AND** 同一次编辑里若还改了不可动画的 Renderer prop，则整条命令原样放行，不做部分改写
