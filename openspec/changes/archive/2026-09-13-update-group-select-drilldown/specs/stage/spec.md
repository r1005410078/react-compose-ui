## ADDED Requirements

### Requirement: Group 在画布上先选组，双击进组

Stage 上单击一个 first-class Group 里的对象 MUST 选中**最外层还没进入**的 Group，选框是它可见
后代的并集；双击 MUST 穿过一层，选中那个 Group 的直接子级；进了组之后（选区里有它的任何后代）
单击兄弟 MUST 直接选中兄弟；点空白清掉选区即退出，此后单击子级又回到 Group。按住
`Ctrl`/`⌘` 单击 MUST 无视门槛直接选中命中的对象（深选）。解算 MUST 复用 `stage-engine` 的
`resolveStageGroupHit`，Stage MUST NOT 另存一份「当前进到哪一层」的状态。

右键 MUST 与左键过同一道门槛：落在没进入的 Group 的子级上，菜单打开的是那个 Group 的，选区
也改成它。

容器（Frame、Auto Layout 容器）MUST NOT 是门槛：容器的子级一直是直接可点的。

#### Scenario: 单击子级选中 Group

- **WHEN** 选区为空，用户单击 Group 里一个矩形的描边
- **THEN** Inspector 显示 Group，选框宽度等于两个子级并集的宽度

#### Scenario: 双击进组

- **WHEN** Group 已选中，用户在同一处双击
- **THEN** Inspector 显示 Rectangle，选框是那个矩形自己的盒

#### Scenario: 进组后兄弟直选

- **WHEN** 选区是 Group 里的一个子级，用户单击它的兄弟
- **THEN** 选区变为兄弟，不回到 Group

#### Scenario: 点空白退出

- **WHEN** 用户点空白清掉选区，再单击 Group 的子级
- **THEN** 选中的又是 Group

#### Scenario: ⌘/Ctrl 点击深选

- **WHEN** 选区为空，用户按住 `⌘`（或 `Ctrl`）单击 Group 里一个矩形的描边
- **THEN** 选中的是那个矩形

#### Scenario: 右键 Group 的子级

- **WHEN** 选区为空，用户在 Group 的子级上右键
- **THEN** 选区变为那个 Group，菜单作用于它

## MODIFIED Requirements

### Requirement: 组件实例内部下钻与命中

Stage MUST 支持穿透进组件实例内部的命中与选择。默认单击 MUST 选中实例整体；双击 MUST 逐层下钻，
并受既有八层上限约束。下钻 MUST 复用已归一化的 clickCount，MUST NOT 引入独立计时。内部选区 MUST
使用与 Scene Tree 一致的复合地址，并与 Scene Tree 的展开与选中状态双向同步。选中实例整体时，
Stage MUST 只呈现一层选中框语义（对应宿主外框/根尺寸），MUST NOT 因宿主壳与嵌套根各画一套
外观而出现双层可见色块；嵌套内容的 Appearance 渲染 MUST 与组件文档 Stage 路径一致。

实例被一个**还没进入**的 Group 门着时（按单击解算出来的对象不是实例自己），双击 MUST 先进那个
Group、选中实例整体，MUST NOT 直接下钻进实例内部；进了组之后再双击才下钻。判据 MUST 按单击
解算——带上连击计数解算出来的可能正是实例自己（穿过门槛落到的直接子级），而那一下仍然只该
选中实例。下钻进实例内部之后，包着这个实例的 Group MUST 算已进入（复合地址按宿主实例算）。

#### Scenario: 默认选中实例整体

- **WHEN** 用户单击组件实例
- **THEN** 选区是实例 Entity 本身，内部实体不被单独选中

#### Scenario: 双击下钻选中内部实体

- **WHEN** 用户在 select 工具下双击实例
- **THEN** 命中穿透到内部实体，选区为对应复合地址且不启动移动手势
- **AND** Scene Tree 同步展开并高亮同一节点

#### Scenario: 实例被 Group 门着时双击先进组

- **WHEN** 实例在一个还没进入的 Group 里，用户在 select 工具下双击实例
- **THEN** 选区变为实例整体，不下钻进实例内部
- **AND** 再双击一次才下钻到内部实体
