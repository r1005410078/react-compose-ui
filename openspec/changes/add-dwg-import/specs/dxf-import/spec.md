## MODIFIED Requirements

### Requirement: DXF 导入产出页面导入计划

系统 MUST 提供无 React、无 DOM 的 `@compose-ui/dxf`，把一段 ASCII DXF 映射为一份**导入
计划**：一块场景、若干 Component Asset 与诊断。

本包 MUST NOT 依赖 Registry、物料或任何 UI：Entity 的 Preset seed 与 ID 工厂 MUST 由调用方
注入。产出计划而不是直接写盘，因为一次导入落**两类资源**（页面文件与组件文件），它们分属
不同的 Store；纯函数产出、宿主写入，测试因此不需要假造 Store。

分词层与记录层 MUST 与既有实现一致：它们认识的是 DXF 的组码结构，与产出什么文档无关。
记录 MUST 保留组码/值的**数组**而不是收成映射——`LWPOLYLINE` 的顶点正是重复出现的
`10`/`20`，收成映射会只剩最后一个顶点。

映射层 MUST 可以被别的编码共用：本包 MUST 导出一个吃 `DxfRecord[]` 的入口，吃文本的
`planDxfImport` MUST 是它之上的一行封装（分词 + 分组）。DWG 是同一份数据的另一种编码，
换掉的只有分词层与记录层；没有这条缝，另一种编码就只能把整个映射层 fork 一份，而那份
副本会与本体静默漂移。签名与行为 MUST NOT 因此改变。

#### Scenario: 顶层图元落进场景

- **WHEN** 导入含 `LINE`、`CIRCLE`、`ARC`、`LWPOLYLINE`、`TEXT` 的 DXF
- **THEN** 计划里的场景含对应的 Entity，且几何写在 `Curve` 或文字物料上
- **AND** 整圆是 `sweep` 绝对值为 360 的 `arc`，闭合折线是 `closed` 为真的 `polyline`

#### Scenario: 不认识 Registry

- **WHEN** 调用方注入一份自定义的 Preset seed
- **THEN** 产出的 Entity 基于该 seed，本包不引用任何物料包

#### Scenario: 记录层入口与文本入口等价

- **WHEN** 同一份 DXF 分别经文本入口与「先分词分组再走记录层入口」两条路导入
- **THEN** 两份导入计划逐字段相同
