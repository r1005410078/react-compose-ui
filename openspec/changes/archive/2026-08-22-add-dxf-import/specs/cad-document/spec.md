## ADDED Requirements

### Requirement: DXF 导入器

系统 MUST 提供无 React、无 DOM 的 `importDxfDocument(text)`，把一段 ASCII DXF 映射为
`CadDocument` 与一份诊断清单。它 MUST 是纯函数：喂字符串、断言结果，不依赖交互内核与资源
系统。

MUST 支持的实体：`LINE`、`CIRCLE`、`ARC`、`LWPOLYLINE`、`TEXT`、`INSERT`；MUST 支持 `LAYER`
表与 `BLOCKS` 段。

解析 MUST 保留同一条记录内**重复出现的组码**，MUST NOT 把记录收成「组码 → 单值」的映射——
`LWPOLYLINE` 的顶点正是重复出现的 `10`/`20`，收成映射会只剩最后一个顶点。

产出的文档 MUST 通过既有的 CAD 文档校验。

#### Scenario: 基本实体各自映射到对应图元

- **WHEN** 导入含 `LINE`、`CIRCLE`、`ARC`、`LWPOLYLINE`、`TEXT` 的 DXF
- **THEN** 得到对应的直线、整圆、圆弧、多段线与文字图元
- **AND** 文档通过校验

#### Scenario: 长折线的顶点不被折叠

- **WHEN** 导入一条含五个顶点的 `LWPOLYLINE`
- **THEN** 多段线有五个顶点，而不是一个

#### Scenario: 闭合标志被读出

- **WHEN** `LWPOLYLINE` 的 `70` 组码带闭合位
- **THEN** 多段线是闭合的

### Requirement: DXF 导入的坐标翻转

DXF 的 Y 轴朝上而屏幕的 Y 轴朝下，导入 MUST 翻转 Y。翻转 MUST 同时取反**角度**：圆弧的起始
角与扫掠、文字旋转、块实例旋转。块实例的**比例 MUST 保持不变**。

这三条 MUST 一起成立：它们是同一个矩阵恒等式的三个推论（`F R(θ) F = R(−θ)`、`F S F = S`）。
只翻位置不翻角度的症状是「图看起来像镜像的」，很容易被误当成源文件本身的问题。

#### Scenario: 位置翻转

- **WHEN** 导入一条 DXF 坐标为 `(10, 20)` 到 `(30, 40)` 的直线
- **THEN** 结果的端点是 `(10, -20)` 与 `(30, -40)`

#### Scenario: 不对称圆弧的角度取反

- **WHEN** 导入一段起角 30°、终角 100° 的 DXF 圆弧
- **THEN** 结果的起始角是 −30°，扫掠是 −70°
- **AND** 弧上的采样点与「先按 DXF 求点再翻转 Y」的结果一致

#### Scenario: 块实例的旋转取反而比例不变

- **WHEN** 导入一个旋转 30°、x/y 比例为 2 与 3 的 `INSERT`
- **THEN** 实例旋转为 −30°，比例仍是 2 与 3

### Requirement: DXF 导入诊断

导入 MUST 返回诊断清单，说明哪些内容没有被完整表达。每条诊断 MUST 带**稳定机器码**，同类
问题 MUST 按类型聚合计数而不是逐条报告。

系统 MUST NOT 静默丢弃不支持的内容——用户拿导入结果与原图一对，发现少了东西却没有解释，
只会认为工具不可靠。系统同样 MUST NOT 因为存在不支持的实体而拒绝整份文件：一个
`DIMENSION` 不该让 95% 可用的图导不进来。

带 `bulge` 的多段线段 MUST 按**弦**导入并给出诊断，MUST NOT 静默变成直线。

#### Scenario: 不支持的实体被跳过并报告

- **WHEN** 导入含三个 `SPLINE` 与一个 `HATCH` 的 DXF
- **THEN** 这些实体不进文档
- **AND** 诊断里有一条 `SPLINE` 计数为 3、一条 `HATCH` 计数为 1

#### Scenario: bulge 按弦导入并报告

- **WHEN** `LWPOLYLINE` 的某个顶点带非零 `bulge`
- **THEN** 该段按弦导入
- **AND** 诊断里有对应机器码

### Requirement: DXF 图层与块的映射

图层 MUST 以 DXF 的图层名作为 id。图层 `0` MUST 始终存在，文件未提供时补一个。实体引用了
表里没有的图层时 MUST 落回 `0` 并给出诊断，MUST NOT 拒绝整份文件。

`BLOCK` MUST 映射为块定义，块内几何 MUST 以**基点**为原点换算为块局部坐标。名字以 `*` 开头
的布局块 MUST 跳过。块内出现 `INSERT` 时 MUST 跳过该实体并给出诊断——本仓拒绝嵌套块，硬导会
让整份文档不合法。

#### Scenario: 块与实例成对导入

- **WHEN** 导入一份含 `BLOCK` 定义与引用它的 `INSERT` 的 DXF
- **THEN** 得到块定义与块实例
- **AND** 块内几何按基点换算为块局部坐标

#### Scenario: 未知图层落回 0

- **WHEN** 某个实体引用了 `LAYER` 表里没有的图层名
- **THEN** 它落在图层 `0` 上并产生一条诊断

#### Scenario: 布局块与嵌套块

- **WHEN** DXF 含 `*Model_Space` 块，或某个块内含 `INSERT`
- **THEN** 前者被跳过，后者跳过该实体并产生诊断

### Requirement: CAD 画布打开时按内容取景

CAD 画布首次量到真实图面尺寸后，若文档含可见几何，MUST 把视口取到该几何的包围盒上。文档为
空时 MUST NOT 改动视口。

真实图纸的坐标动辄几千、几十万，按默认视口打开会是一片空白，而用户会认为导入失败了。

取景 MUST 是**会话状态**而不是文档状态，且宿主 MUST 能关闭它。

#### Scenario: 打开有内容的图纸即可见

- **WHEN** 打开一份几何远离原点的 CAD 文档
- **THEN** 图面上看得见这些几何

#### Scenario: 空文档不改动视口

- **WHEN** 打开一份空的 CAD 文档
- **THEN** 视口保持默认，新建流程的手感不变
