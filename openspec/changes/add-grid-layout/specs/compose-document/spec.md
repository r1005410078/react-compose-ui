## RENAMED Requirements

- FROM: `### Requirement: 可选 Flex Layout Component`
- TO: `### Requirement: 可选 Layout Component`

## MODIFIED Requirements

### Requirement: 可选 Layout Component

Layout MUST 只与 Hierarchy 组合，并 MUST 是按 `type` 判别的联合：`flex` 成员保存明确的
Flex direction、wrap、alignContent、justifyContent、alignItems、四边 padding、rowGap 与
columnGap；`grid` 成员见「网格 Layout 类型」。Flow LayoutItem MUST 仅位于直接拥有 Layout 的
parent 下；根级或 free parent 的子项 MUST 为 Absolute。

判别字段 `type` 缺失或不是已知成员时 MUST 拒绝，MUST NOT 回退到 `flex`——回退会让一份
写坏的 grid 文档静默渲染成一条轴上的序列，而用户无从得知。

#### Scenario: 校验 Flow 与 Absolute 位置模式
- **WHEN** Layout parent 包含 Fixed Flow 与 Absolute 子项
- **THEN** 文档通过校验且 Hierarchy.childIds 决定 Flow 顺序
- **AND** 根级 Flow、free parent 下 Flow 或非法数值被拒绝

#### Scenario: 未知布局类型被拒绝
- **WHEN** 文档里某个 Layout 的 `type` 不是 `flex` 也不是 `grid`
- **THEN** 校验拒绝并给出可定位的 issue
- **AND** MUST NOT 按 `flex` 兜底求解

## ADDED Requirements

### Requirement: 网格 Layout 类型

`Layout` MUST 支持 `type: 'grid'` 成员，保存列数 `columns`、行高 `rowHeight`（逻辑像素）、
`rowGap` 与 `columnGap`、四边 `padding`，以及重力开关 `float`（`false` 表示空洞被自动填上，
是默认值）。`columns` MUST 是不小于 1 的整数，`rowHeight` MUST 是有限正数，其余数值 MUST 是
有限非负数。

列宽 MUST 由容器内容宽、`columns` 与 `columnGap` 推出，MUST NOT 写进文档——同一份事实存两处
必然漂移。行高相反 MUST 由作者给定：容器宽度会随宿主变，而"一行有多高"是设计决定。

#### Scenario: 校验合法网格 Layout
- **WHEN** 容器带有 Hierarchy 与 `type: 'grid'` 的 Layout，`columns` 为 12、`rowHeight` 为 48
- **THEN** 文档通过校验
- **AND** 文档里不含任何列宽字段

#### Scenario: 拒绝非法网格参数
- **WHEN** `columns` 为 0、负数或小数，或 `rowHeight` 不是有限正数
- **THEN** 校验拒绝并给出指向该字段的 issue

### Requirement: 可选 GridItem Component

`GridItem` MUST 是可选 Entity Component，保存格坐标 `x`、`y` 与格跨度 `w`、`h`，
可选 `minW`、`minH`。全部 MUST 是整数，`x`、`y` MUST 不为负，`w`、`h` MUST 不小于 1。

**缺席即不在格中**，与 `Ports`、`Curve`、`Frame` 是同一条判断。它 MUST 只在父级拥有
`type: 'grid'` 的 Layout 时有意义；父级不是网格容器时 MUST NOT 让文档非法（切换布局类型
是一次编辑，中间态不应阻断保存），但求解 MUST 忽略它。

格中子级的 `LayoutItem.positioning` MUST 是 `flow`：它确实参与父级排布，**怎么排**由父级
Layout 的类型决定。这让既有的"根级与 free parent 下必须 Absolute"校验规则原样成立。

`w` 超出 `columns` 时 MUST 在读取时钳制到 `columns`，MUST NOT 回写——那个数是作者的意图，
容器改回更多列时应当复原。与多段线圆角的钳制是同一条判断。

#### Scenario: 校验合法 GridItem
- **WHEN** 网格容器的 Flow 子级带有 `{x: 0, y: 2, w: 4, h: 2}` 的 GridItem
- **THEN** 文档通过校验

#### Scenario: 拒绝非法格坐标
- **WHEN** `w` 小于 1、`x` 为负，或任一字段不是整数
- **THEN** 校验拒绝并给出指向该字段的 issue

#### Scenario: 跨度超出列数在读取时钳制
- **WHEN** 子级 `w` 为 16 而容器 `columns` 为 12
- **THEN** 求解按 12 格呈现
- **AND** 文档里的 `w` 仍是 16，容器改回 16 列时恢复原跨度

### Requirement: 网格求解是 core 的纯函数

网格的碰撞检测、向下推挤与重力上浮 MUST 由 `core` 的纯函数承担，输入是一组
`{id, x, y, w, h}` 与网格参数，输出是解算后的同形状一组。它 MUST NOT 读取文档、
Snapshot 或任何 React/DOM 对象。

住 `core` 而不是 `layout-engine`，判据与 `curve-geometry.ts` 逐字相同：它有两个消费者
（Layout Runtime 求解、Stage Engine 算落点），而 `stage-engine` 不依赖 `layout-engine`。
整个模块 MUST 放在一起而不按消费者拆——把推挤挪走会让碰撞数学横跨两个包。

推挤 MUST 只向下，MUST NOT 交换：尺寸不同时换不了，会让同一个动作有时交换、有时推挤。
重力 MUST 只向上，MUST NOT 向左靠：列是作者的构图意图，行不是。
次序 MUST 是**先推挤后重力**。

本次手势的目标 MUST 只在**碰撞解算**里是权威的（先按它请求的位置落下，其余子级为它让路），
MUST NOT 豁免重力。豁免会让求解**不再幂等**——把一张卡拖到空网格的第 5 行、它停在那里，
而下一次任何编辑触发重新求解时它已不再是目标，于是自己跳到第 0 行去；一个在用户没动手的
时候自己移动的对象，屏幕上没有任何东西解释它为什么动。

求解 MUST 幂等：对已经解算过的一组格矩形再求解一次 MUST 逐字段相同。

#### Scenario: 落点占住已有卡片时向下推挤
- **WHEN** 一张 4×2 的卡被放到 `(0, 2)`，那里已经有一张 7×2 的卡
- **THEN** 原有那张下移到不再重叠的第一行
- **AND** 没有被压住的卡片位置不变

#### Scenario: 重力填上空洞
- **WHEN** 重力开启且中间一行的卡片被删除
- **THEN** 下方卡片各自上浮到它们上方第一个不重叠的行
- **AND** 卡片的列坐标不变

#### Scenario: 重力关闭时保持作者行号
- **WHEN** `float` 为 `true` 且中间一行被删除
- **THEN** 下方卡片停在原行，网格中间留空

#### Scenario: 连锁推挤
- **WHEN** 落点压住 A，A 下移后压住 B，B 下移后压住 C
- **THEN** 三者依次下移到各自不再重叠的位置
- **AND** 求解终止，不产生循环

#### Scenario: 手势目标同样受重力作用
- **WHEN** 重力开启，用户把一张卡拖到空网格的第 5 行
- **THEN** 它落在第 0 行
- **AND** 对该结果再求解一次，位置不变

#### Scenario: 求解幂等
- **WHEN** 对任意一组格矩形连续求解两次
- **THEN** 两次结果逐字段相同
