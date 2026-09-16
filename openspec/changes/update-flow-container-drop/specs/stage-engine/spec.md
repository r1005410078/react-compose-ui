## ADDED Requirements

### Requirement: 跨容器落进 Flex 容器时解算插入位

落点解算 MUST 在跨容器落进一个 Flex 容器时给出插入位，与网格容器给出格坐标对称；该落点
MUST 复用同容器重排的那一份插入位解算，MUST NOT 另立一套规则。

`StageDropTarget` 的 `reorder` MUST 表示「落进 `containerId` 的第 `index` 位」，父级变没变
由提交方比较 `containerId` 与当前父级得出；它 MUST NOT 隐含选区停留在原容器。

提交方在 `reorder` 的 `containerId` 不是当前父级时 MUST 走 reparent 的几何处理（Flex 容器
丢弃 offset 改走 flow），并把插入位作为新父级 `childIds` 的下标；是当前父级时 MUST 只改
`Hierarchy.childIds` 顺序。两种情形 MUST 各只提交一条命令。

#### Scenario: 从物料面板拖进排队容器成为同级子项

- **WHEN** 用户把一个新节点拖进一个已有一个 Flow 子级的 Flex 容器并松手
- **THEN** 该节点成为该容器的第二个 Flow 子级
- **AND** 它 MUST NOT 成为第一个子级的后代

#### Scenario: 插入位决定落在哪两个之间

- **WHEN** 用户把节点拖到 Flex 容器中两个 Flow 兄弟之间并松手
- **THEN** 提交的命令把它插在这两个兄弟之间对应的 `childIds` 位置

#### Scenario: 跨容器插入只提交一条命令

- **WHEN** 一次拖拽把节点从别的父级插进某个 Flex 容器的指定位置
- **THEN** 只提交一条命令，撤销一步即回到拖动之前

### Requirement: Flex 容器的 Flow 子级不接管落点

指针落在一个 Flex 容器的 Flow 子级上时，落点 MUST 归它的 Flex 父级，由插入位说明放在哪两个
之间；该 Flow 子级 MUST NOT 成为 reparent 目标。

这条 MUST 同时作用于**画布拖动手势**与**外部拖入**（物料面板拖放、点击添加、画布右键添加）
两条落点路径，且 MUST 只有一处实现——两条路各判一次必然分叉，而分叉的症状是「同一个位置，
拖物料与拖画布上的对象落进不同的父级」。外部拖入 MUST NOT 因此要求深入内部判定：它是一次
明确的落子，不是贴边掠过。

按住 `Alt` 时 MUST 恢复既有语义，以指针命中的最内层合法容器为 reparent 落点。

最内层候选容器不满足深入内部判定时，解算 MUST 上浮到最近一个满足该判定的祖先容器，
MUST NOT 直接交回「没有落点」。

#### Scenario: 拖到已占满父级的子项上仍落在父级

- **WHEN** Flex 容器的第一个 Flow 子级盖住了容器中心，用户把节点拖到那里松手
- **THEN** 落点是该 Flex 容器，节点成为它的同级子项

#### Scenario: Alt 下钻进 Flow 子级

- **WHEN** 用户按住 `Alt` 把节点拖到一个 Flex 容器的 Flow 子容器上松手
- **THEN** 节点成为那个 Flow 子容器的子级

#### Scenario: 从物料面板往同一处连拖两个得到同级子项

- **WHEN** 用户把一个物料拖进空的 Flex 容器，再把第二个物料拖到**第一个子级身上**松手
- **THEN** 两个新节点都是该 Flex 容器的直接子级
- **AND** 第二个 MUST NOT 成为第一个的后代

#### Scenario: 贴着边缘时上浮到祖先而不是没有落点

- **WHEN** 指针落在某个容器内但位于它的边缘留白里，而它的某个祖先容器满足深入判定
- **THEN** 落点是那个祖先容器
- **AND** MUST NOT 交回「没有落点」
