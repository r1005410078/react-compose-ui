## MODIFIED Requirements

### Requirement: Group 在画布上先选组，双击进组

Stage 上单击一个 first-class Group 里的对象 MUST 选中**最外层还没进入**的 Group，选框是它可见
后代的并集；双击 MUST 穿过一层，选中那个 Group 的直接子级；进了组之后（选区里有它的任何后代）
单击兄弟 MUST 直接选中兄弟；点空白清掉选区即退出，此后单击子级又回到 Group。按住
`Ctrl`/`⌘` 单击 MUST 无视门槛直接选中命中的对象（深选）。解算 MUST 复用 `stage-engine` 的
`resolveStageGroupHit`，Stage MUST NOT 另存一份「当前进到哪一层」的状态。

空闲时（没有手势、命令或几何编辑会话在跑）按 `Escape`，选区是某个 Group 的后代时 MUST 选中
那个最近的共同 Group（回到上一层，读 `resolveStageGroupExit`）；没有更外层的 Group 时 MUST 保持
既有行为。手势进行中的 `Escape` MUST 仍只中止手势。

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

#### Scenario: Escape 退出分组

- **WHEN** 选区是 Group 里的一个子级，用户按 `Escape`
- **THEN** 选区变为那个 Group
- **AND** 再按一次 `Escape`，选区不变

#### Scenario: 点空白退出

- **WHEN** 用户点空白清掉选区，再单击 Group 的子级
- **THEN** 选中的又是 Group

#### Scenario: ⌘/Ctrl 点击深选

- **WHEN** 选区为空，用户按住 `⌘`（或 `Ctrl`）单击 Group 里一个矩形的描边
- **THEN** 选中的是那个矩形

#### Scenario: 右键 Group 的子级

- **WHEN** 选区为空，用户在 Group 的子级上右键
- **THEN** 选区变为那个 Group，菜单作用于它
