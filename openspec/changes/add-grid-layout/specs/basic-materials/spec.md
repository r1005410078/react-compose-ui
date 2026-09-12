## MODIFIED Requirements

### Requirement: 忽略 Auto Layout 开关

几何 Inspector MUST 为父级是 Layout 容器的 Entity 提供脱离父级排布的开关，作为
Flow↔Absolute 的唯一显式转换入口；父级不是 Layout 容器时 MUST NOT 显示该开关。
开关文案 MUST 跟随父级的布局类型：父级是 Auto Layout 时是「忽略 Auto Layout」，
父级是网格时是「忽略网格」——一个说 Auto Layout 的开关出现在网格容器的子级上，
用户会以为自己看错了面板。

开启（脱流）MUST 在单条事务内：把 `positioning` 切为 `absolute`，offset 从当前布局 box 反算使
视觉位置不变，并把 fill 轴烘焙为 fixed（值取当前求解尺寸），与 reparent 移出 Flow 的既有烘焙
规则一致。父级是网格时同一条事务 MUST 一并删除该 Entity 的 `GridItem`，并把当前解算尺寸烘焙
为 fixed——网格子级的轴尺寸模式在格中被忽略，脱流后必须有一个确定的尺寸。

关闭（回流）MUST 在单条事务内把 `positioning` 切回 `flow`，保持当前 `childIds` 位置
不变，并按进入 Auto Layout 容器的既有交叉轴采纳规则处理 axis sizing。父级是网格时
MUST 改为按当前视觉位置与尺寸就近落格并写入 `GridItem`，且 MUST 走同一个网格求解器处理
落格产生的碰撞。两个方向 MUST 均可一次 undo 恢复。

#### Scenario: 开启开关脱流且视觉位置不变

- **WHEN** 用户对 Auto Layout 容器内的 Flow 子级开启「忽略 Auto Layout」
- **THEN** 一条事务把该子级切为 Absolute，offset 反算自当前布局 box，fill 轴烘焙为 fixed
- **AND** 切换前后子级在画布上的视觉位置一致，undo 一次恢复

#### Scenario: 关闭开关回流并采纳容器规则

- **WHEN** 用户对已脱流的子级关闭「忽略 Auto Layout」
- **THEN** 一条事务把该子级切回 Flow，`childIds` 位置不变
- **AND** axis sizing 按进入容器的既有采纳规则改写，undo 一次恢复

#### Scenario: 网格子级脱流时删除 GridItem

- **WHEN** 用户对网格容器内的子级开启「忽略网格」
- **THEN** 一条事务把该子级切为 Absolute、删除其 `GridItem`，并把当前解算尺寸烘焙为 fixed
- **AND** 切换前后视觉位置与尺寸一致，undo 一次恢复

#### Scenario: 网格子级回流时就近落格

- **WHEN** 用户对网格容器内已脱流的子级关闭「忽略网格」
- **THEN** 一条事务按其当前视觉位置与尺寸写入最接近的 `GridItem` 并切回 Flow
- **AND** 落格产生的碰撞按网格求解器推挤，undo 一次恢复

#### Scenario: 开关文案跟随父级布局类型

- **WHEN** 选中的 Entity 父级是网格容器
- **THEN** 开关文案是「忽略网格」
- **AND** 父级是 Auto Layout 容器时文案是「忽略 Auto Layout」

#### Scenario: 非 Layout 父级不显示开关

- **WHEN** 选中 Entity 的父级不是 Layout 容器
- **THEN** 几何 Inspector 不渲染该开关
- **AND** 其余几何字段呈现不受影响

## ADDED Requirements

### Requirement: 网格按需启用

Container MUST 支持显式启用、移除网格，以及在网格与 Auto Layout 之间切换。启用 MUST 在一个
事务内添加 `type: 'grid'` 的 Layout、把直接子项转为 Flow，并按每个子项**当前的视觉位置与
尺寸**就近写入 `GridItem`；落格产生的碰撞 MUST 由网格求解器一并解开。任一受影响子项锁定时
MUST NOT 生成命令。

移除网格 MUST 把布局结果烘焙回自由布局所需的持久化几何，并删除全部 `GridItem`，与移除
Auto Layout 的既有规则一致。

布局类型之间的切换 MUST 是一条事务且一次 undo 恢复。切换 MUST 在入口处明示代价——切到网格
丢弃 `alignSelf`，切回 Auto Layout 丢弃格坐标；这两样都无法从对侧推导回来，静默丢弃会让
用户在撤销之后才发现。

缺席 Layout 时的 `+` 菜单 MUST 同时列出两种布局，引导卡 MUST 同时介绍两者并提供二选一的
两个动作——只讲其中一种会让另一种在这个入口上不可发现。

#### Scenario: 单事务启用网格并就近落格

- **WHEN** 用户在自由 Container 上启用网格
- **THEN** 一个事务内添加 grid Layout、把全部直接子项转为 Flow 并写入就近的 `GridItem`
- **AND** 落格碰撞按求解器推挤，一次 undo 恢复

#### Scenario: 子项锁定时不生成命令

- **WHEN** 容器内任一直接子项被锁定
- **THEN** 启用网格不产生任何命令

#### Scenario: 缺席 Layout 时两种布局都可发现

- **WHEN** 选中一个还没有 Layout 的 Container
- **THEN** `+` 菜单同时列出 Auto Layout 与网格，引导卡提供两个动作
- **AND** 引导卡的标题与正文不只描述其中一种

#### Scenario: 切换布局类型明示代价

- **WHEN** 用户把网格容器切换为 Auto Layout
- **THEN** 入口上写明格坐标会被丢弃
- **AND** 切换是一条事务，一次 undo 恢复全部格坐标

### Requirement: 紧凑网格 Inspector

网格容器的「布局」分组 MUST 提供列数、行高、两轴项间距、四边内边距与重力开关，并 MUST 与
Auto Layout 分组共用同一个分组标题栏结构：一个说明当前布局类型的状态标记、一个在值等于默认值
时禁用的整体重置，以及一个承载移除与切换的菜单。状态标记 MUST 渲染——两种布局共用一个分组
标题，不印出来就分不出当前是哪一种。

项间距与内边距 MUST 复用 Auto Layout 分组已有的 editor：两者都不含任何 flex 语义
（一个是两轴数值对，一个是四边数值），各写一份会让"间距"在两种布局里长得不一样。

列数 MUST 附带一条按当前列数分段的内联指示条。网格分组 MUST NOT 渲染 Auto Layout 那样的
三节点实时预览——网格的字段全是数字而画布本身就是结果，再画一个小的等于同一句话说两遍。

网格分组 MUST NOT 出现方向、换行或任何对齐字段：位置由格坐标直接给出，没有可对齐的余量。

#### Scenario: 网格分组的字段集合

- **WHEN** 选中一个网格容器
- **THEN** 布局分组显示列数、行高、项间距、内边距与重力开关
- **AND** 不显示方向、换行、主轴、交叉轴或多行对齐

#### Scenario: 分组标题栏标明当前布局类型

- **WHEN** 分别选中网格容器与 Auto Layout 容器
- **THEN** 两者的布局分组标题栏各自标出自己的类型
- **AND** 值等于默认值时重置按钮禁用

#### Scenario: 列数指示条跟随列数

- **WHEN** 用户把列数从 12 改为 8
- **THEN** 列数字段下的指示条变为 8 段

### Requirement: 几何 Inspector 的网格档

几何 Inspector MUST 按 Entity 的排布方式切换首个字段：Absolute 显示位置、Flow 显示自身对齐，
**父级是网格容器的 Flow 子级** MUST 改为显示格位置（列、行）与格跨度（宽、高），
并 MUST NOT 显示自身对齐——网格里没有主轴与交叉轴，自身对齐没有可作用的余量。

这四个数 MUST 可键入，键入产生的碰撞 MUST 走与画布拖动同一个网格求解器：画布与面板是同一份
事实的两个入口，分开求解会让键入与拖动给出不同结果。

「尺寸」行 MUST 降为只读并呈现当前求解结果，MUST NOT 隐藏——盒就是格矩形，三种尺寸模式一个
都用不上，但"它现在到底多少像素"仍是正当问题。「外边距」行 MUST 隐藏：间距归容器，每张卡再
各带一份会让"两张卡之间多远"有两个来源。旋转与旋转基点 MUST 照常显示——它们来自 `Transform`，
与布局正交。

格位置与格跨度 MUST 写进 `GridItem`，MUST NOT 写进 `LayoutItem.offset` 或 `Transform`。

#### Scenario: 网格子级显示格坐标而不是位置

- **WHEN** 选中网格容器内的一张卡
- **THEN** 几何 Inspector 显示格位置与格跨度，各自两个整数字段
- **AND** 不显示位置 X/Y，也不显示自身对齐

#### Scenario: 键入格坐标与拖动结果一致

- **WHEN** 用户在面板里把格位置从 `(8, 0)` 改为 `(0, 2)`，该处已有另一张卡
- **THEN** 被压住的卡按求解器下移，结果与在画布上拖到同一格一致
- **AND** 写入的是 `GridItem`，`LayoutItem.offset` 不变

#### Scenario: 尺寸只读而外边距隐藏

- **WHEN** 选中网格容器内的一张卡
- **THEN** 尺寸行呈现当前求解出的像素值且不可编辑
- **AND** 不渲染外边距行，旋转与旋转基点照常渲染
