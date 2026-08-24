# dxf-import 规范增量

## ADDED Requirements

### Requirement: DXF 导入产出页面导入计划

系统 MUST 提供无 React、无 DOM 的 `@compose-ui/dxf`，把一段 ASCII DXF 映射为一份**导入
计划**：一块场景、若干 Component Asset 与诊断。

本包 MUST NOT 依赖 Registry、物料或任何 UI：Entity 的 Preset seed 与 ID 工厂 MUST 由调用方
注入。产出计划而不是直接写盘，因为一次导入落**两类资源**（页面文件与组件文件），它们分属
不同的 Store；纯函数产出、宿主写入，测试因此不需要假造 Store。

分词层与记录层 MUST 与既有实现一致：它们认识的是 DXF 的组码结构，与产出什么文档无关。
记录 MUST 保留组码/值的**数组**而不是收成映射——`LWPOLYLINE` 的顶点正是重复出现的
`10`/`20`，收成映射会只剩最后一个顶点。

#### Scenario: 顶层图元落进场景

- **WHEN** 导入含 `LINE`、`CIRCLE`、`ARC`、`LWPOLYLINE`、`TEXT` 的 DXF
- **THEN** 计划里的场景含对应的 Entity，且几何写在 `Curve` 或文字物料上
- **AND** 整圆是 `sweep` 绝对值为 360 的 `arc`，闭合折线是 `closed` 为真的 `polyline`

#### Scenario: 不认识 Registry

- **WHEN** 调用方注入一份自定义的 Preset seed
- **THEN** 产出的 Entity 基于该 seed，本包不引用任何物料包

### Requirement: DXF 的块映射为组件资产

BLOCK MUST 映射为一份 Component Asset v2，INSERT MUST 映射为引用它的组件实例；同一个块的
多次插入 MUST 共用同一份资产。

组件文档的根 MUST 是 Frame（既有不变量），其尺寸取块内几何的紧包围盒，几何归一化到该包围盒
的左上角。

嵌套块 MUST NOT 导入，MUST 给出既有的可判别诊断：组件实例套实例在页面世界可表达，但它引出
「实例内部再下钻」的一整套问题，不该由导入器顺手决定。

`*Model_Space` 这类布局块 MUST NOT 进入块表，其内容也 MUST NOT 掉到顶层——它属于那个块。

#### Scenario: 一个块两次插入

- **WHEN** 导入含一个 `BLOCK` 定义与引用它的两个 `INSERT` 的 DXF
- **THEN** 计划里有一份组件资产与两个组件实例，两者引用同一个资产

#### Scenario: 块内的 INSERT 被拒绝并报告

- **WHEN** 某个块定义内部含 `INSERT`
- **THEN** 该实体不进入计划，诊断中出现嵌套块一项

### Requirement: 块基点映射为实例的旋转基点

INSERT 的旋转 MUST 绕**块基点**发生。块基点 MUST 写进实例的 `Transform.pivot`（归一化盒
坐标），实例位置 MUST 相应补偿，使转轴落回插入点。

基点落在块几何包围盒**之外**时 MUST 同样成立——`pivot` 不钳制到 `[0, 1]` 正是为这种情形
留的口子。

#### Scenario: 基点在盒外的块被旋转插入

- **WHEN** 一个基点落在自身几何包围盒之外的块以非 90 度的角度插入
- **THEN** 实例的几何与「先按 DXF 绕基点旋转再翻转 Y」的结果一致

#### Scenario: 基点即盒中心

- **WHEN** 块基点恰好落在几何包围盒中心
- **THEN** 结果与不写 `pivot` 逐像素相同

### Requirement: DXF 图层在导入期被求值

图层 MUST NOT 进入页面文档。它携带的四样各自求值到 Entity 上：byLayer 颜色求值进描边、
`visible` 落成 `Visibility`、`locked` 落成 `Lock`、图层名落成 Entity 名字。

图层 MUST NOT 退化成 Group：Group 是空间容器（有盒、参与 Auto Layout、拖动会搬走全部成员），
而图层是分类；把分类做成空间容器会让用户拖一下就搬走半张图。

实体引用了不存在的图层时 MUST 落回图层 `0` 并报告，而不是让整份文件导不进来。

#### Scenario: 关闭的图层

- **WHEN** 某图层的颜色号为负或冻结位置位
- **THEN** 该图层上的 Entity 带不可见标记，但仍然存在且可由用户打开

#### Scenario: 锁定的图层

- **WHEN** 某图层的 `70` 含锁定位
- **THEN** 该图层上的 Entity 带锁定标记

#### Scenario: 未知图层名

- **WHEN** 某实体引用了表里没有的图层名
- **THEN** 该实体按图层 `0` 导入，诊断中出现未知图层一项

### Requirement: 导入的几何归一化到场景

场景尺寸 MUST 取全部顶层内容的紧包围盒（各轴钳到最小 1），几何 MUST 整体平移，使包围盒
左上角落在场景原点。

DXF 的坐标动辄几千几十万，而场景是绝对坐标的原点；不归一化的导入结果会整体落在场景之外。

平移量在原点处 MUST NOT 产出 `-0`：它在 JSON 里写成 `0`，是只在 `Object.is` 与断言里现形的
幽灵差异。

坐标翻转 MUST 与既有实现一致：Y 取反、角度取反、比例不变——三者是同一个恒等式的三个推论，
要么一起对要么一起错。

#### Scenario: 远离原点的图

- **WHEN** 导入一份全部几何落在 `(10000, 20000)` 附近的 DXF
- **THEN** 场景尺寸等于内容包围盒，且内容从场景原点开始

#### Scenario: Y 轴翻转

- **WHEN** 导入一条 DXF 坐标为 `(10, 20)` 到 `(30, 40)` 的直线
- **THEN** 归一化之前它的两端是 `(10, -20)` 与 `(30, -40)`

### Requirement: 导入能导的，报告导不了的

导入 MUST NOT 因为个别表达不了的内容整份失败，也 MUST NOT 静默丢弃。诊断 MUST 带稳定机器码
并**按类型聚合计数**：几百个 `DIMENSION` 逐条报告等于没有报告。

以下情形 MUST 各自有一条诊断：不支持的实体类型、非法的实体数据、未知图层、未知块、嵌套块、
带 `bulge` 的多段线段（按弦导入）、**非 1 缩放的 INSERT**（按 1 导入）。

非 1 缩放无处可放是既有不变量的后果：实例尺寸的唯一事实来源是组件根，而 `Transform` 没有
scale。

#### Scenario: 混合可导与不可导的文件

- **WHEN** 导入含三个 `SPLINE`、一个 `HATCH` 与若干直线的 DXF
- **THEN** 直线全部导入，诊断中不支持的实体各聚合成一项并带计数

#### Scenario: 缩放的插入

- **WHEN** 某个 `INSERT` 的 `41`/`42` 不是 1
- **THEN** 该实例按缩放 1 导入，诊断中出现缩放一项

### Requirement: 资源浏览器上的导入为页面

资源浏览器 MUST 在 `.dxf` 文件的上下文菜单上提供「导入为页面」，且 MUST NOT 在其他文件上
出现——这一项对别的文件毫无意义，常驻只会让菜单更长。

导入 MUST 写入一份新页面文件与全部组件文件，随后打开该页面。目录不支持创建文件时该项 MUST
禁用——消失会让用户以为编辑器不支持 DXF，而实际原因是当前 Provider 只读。

产出的文档 MUST 在写盘前通过校验，非法内容 MUST NOT 落盘：写下去之后用户看到的是一个打不开的
页面，而问题出在几步之前。

有诊断时 MUST 提示用户，提示 MUST 包含各诊断的主题与计数。

#### Scenario: 右键导入

- **WHEN** 用户在一个 `.dxf` 上选择「导入为页面」
- **THEN** 新页面被创建并打开，其激活场景含导入的内容

#### Scenario: 部分导入的提示

- **WHEN** 导入的文件含表达不了的内容
- **THEN** 用户看到一条包含主题与计数的提示

#### Scenario: 目录只读

- **WHEN** 当前目录不支持创建文件
- **THEN** 该菜单项仍然出现，但处于禁用状态
