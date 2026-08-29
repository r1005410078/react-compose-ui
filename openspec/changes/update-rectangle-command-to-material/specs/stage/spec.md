## ADDED Requirements

### Requirement: 绘图命令的盒效果落地成物料 Entity

Stage MUST 把 `StageDraftingEffect.boxes` 里的每一个世界坐标矩形落地成一个 Registry
`rectangle` Preset 的 Entity：带完整 `Appearance`（背景、边框、圆角）与 `LayoutItem`，
MUST NOT 带 `Curve`。

落地 MUST 复用既有的「一个盒 + 一个 Preset → 一个 Entity」实现（`entityFromDrawingSeed`
与 `boundsInParentSpace`），MUST NOT 另写一份。另写一份的症状是「命令画的矩形与拖出来的
容器在 `positioning`、最小尺寸或 Hug 处理上差一点」，而这种差别要等到有人对比两者时才会
被发现。

落点父级 MUST 与曲线一致：盒中心所在的容器，不在任何容器里时落进**激活场景**。
Rectangle Preset 没有 `Hierarchy`，因此按「根层落点按类型分流」它 MUST NOT 升格成新场景。

绘图覆盖层的预览轮廓 MUST 认识 `boxes`，画出那个矩形的四条边。

#### Scenario: R 画出的是矩形物料

- **WHEN** 用户启动 `RECTANGLE` 并取两个对角点
- **THEN** 新建的 Entity 使用 `rectangle` Preset，带 `Appearance`，且没有 `Curve` Component
- **AND** 它的 `LayoutItem` 尺寸等于两个角点确定的宽高

#### Scenario: 取第二点之前就能看见矩形

- **WHEN** `RECTANGLE` 取过第一个角点，指针移动到另一处
- **THEN** 覆盖层画出这两点确定的矩形轮廓，而不是一条对角线

#### Scenario: 画在场景空白处落进激活场景

- **WHEN** 两个角点都落在所有容器之外
- **THEN** 新矩形成为激活场景的子级，MUST NOT 升格成一块新场景
