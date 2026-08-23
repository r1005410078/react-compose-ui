# 设计

## D1 · 基点住 `Transform`，可选，缺席即中心

```ts
interface ComposeTransform {
  readonly rotation: number
  /** 归一化盒坐标；缺席等价于 { x: 0.5, y: 0.5 }。 */
  readonly pivot?: ComposePosition
}
```

**为什么可选而不是必填加默认**：`Transform` 是基础 Component，每个 Entity 都有。写成必填要给
全部既有文档补一个字段，而那次写入除了让 diff 变长什么也没做。缺席即中心还让一条硬约束
自动成立——**没设过基点的文档渲染逐像素不变**。

**为什么归一化而不是像素**：

- `decomposeMatrix(matrix, width, height)` 里的 `width / 2` 本来就是 `width * 0.5`，改成
  `width * pivot.x` 是这条数学上**最小的一处编辑**；像素基点则要在每个调用点先换算。
- resize 之后「铰点在左边缘」比「铰点距顶边 0.5px」成立得多。
- CSS `transform-origin` 原生吃百分比，渲染路径因此是一行，不需要额外算。

不钳制到 `[0,1]`：基点落在盒外是合法的（绕一个外部支点摆动），钳制会把一类正当用法判成非法。

## D2 · `matrixFromTransform` 与 `decomposeMatrix` 必须同时接基点

这两个函数是**一对互逆**：前者把 (盒, 旋转) 变成矩阵，后者把矩阵还原回 (盒, 旋转)。手势的
每一次预览与提交都要走一个来回。

只改其中一个，或者某个调用点漏传基点，它们就不再互逆——症状是**手势提交后对象跳一下**，
位移量等于基点偏移，而且只在非中心基点的对象上出现。因此本刀必须有一条圆桌用例：
非中心基点下 `decompose(matrixFromTransform(t)) === t`。

调用点约十处，全部在 `stage-engine` 内（`interaction-controller`、`transform-preview`、
`structure-commands`、`component-extraction`）。基点从 Entity 读出后随 `StageTransform` 一起
流动，不再单独传参——分开传就是给自己安排一处迟早漏掉的钩子。

## D3 · 渲染是一处改动覆盖三条路径

`composeEntitySceneStyle` 现在写死 `transformOrigin: 'center'`。Stage Scene、Preview 与
**组件实例**三条渲染路径都消费它，因此把它换成按基点算出的百分比，三处一起对。

这是既有漏斗的回报：如果当初三处各写各的 style，这一刀就要改三处并且永远无法确认第四处
不存在。

## D4 · 旋转手势不需要认识基点

旋转工具绕**选区包围盒中心**转（多选时这是唯一合理的中心），做法是对选区施加
`rotationMatrixAround(center, θ)` 再逐个 `decomposeMatrix` 还原。

给 decompose 传上各自的基点之后，这条链自动正确：实体 E 的新矩阵是 `R(θ)·M_E`，按 E 自己的
基点还原出的 `rotation` 恰好是 `原 rotation + θ`，`offset` 随之调整。手势代码一行不改。

**因此本刀不改旋转工具的中心语义**：单选时绕自己基点转是另一个产品判断（AE 是那样，Figma
不是），没有需求推动，不在这一刀里改。

## D5 · v1 的 UI 是九点选择器，协议仍是自由点

曲线几何归一化后**紧包围盒左上角恒为盒原点**，因此一条线的端点必定落在盒的角或边中点上——
刀闸的铰点正是端点。九个锚点（`v.picklist`）覆盖真实用法，且不需要在 `property-panel` 里新
写一个 editor。

文档字段仍是自由 vector2：将来补自定义数值输入或画布手柄，都不动协议。**UI 的约束不上升为
协议的约束**，这是这个仓库反复用的那条判断。

## D6 · 基点写入走 `entity.component.update`

`entity.transform.set` 的载荷是 `ComposeSpatialTransform`（position / size / rotation）——那是
Stage 几何编辑的合成值，本来就没有基点的位置，硬塞会让一个纯几何命令开始携带非几何字段。
基点是 `Transform` 上的一个普通字段，用既有的 `entity.component.update` 写。

## D7 · 刻意不做

- **基点关键帧**：采样器支持 vector2，`['Transform','pivot']` 白拿。但会动的基点意味着「绕
  一个正在移动的点旋转」，而用户还没有这个需求；加进 adornment 列表等于凭空多一条要解释的
  交互。协议已经让好位置，将来加不需要改动这一刀的任何东西。
- **画布上的基点手柄**：AE 式拖拽基点要处理与 resize/rotate 手柄的争抢、非中心基点下的手柄
  摆位，是独立一刀的量。Inspector 先把能力打通。
- **多选公共基点**：见 D4，不改既有中心语义。
