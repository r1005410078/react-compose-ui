## ADDED Requirements

### Requirement: 网格容器内的拖动与缩放规划

Stage Engine MUST 为父级是网格容器的 Entity 提供独立的移动与缩放规划路径：落点解算成
**格坐标**而不是像素 offset，提交写 `GridItem` 而不是 `LayoutItem.offset` 或求解尺寸。

落点 MUST 取被拖盒左上角所在的格，并 MUST 钳制到 `[0, columns - w]`——允许越界会产出一个
永远解算不出来的坐标。缩放 MUST 把被拖的那条边吸到最近的格线，并 MUST 尊重 `GridItem` 的
`minW` / `minH`。

一次手势 MUST 规划成**一条**事务：目标的新格坐标与被它推挤的全部兄弟的新格坐标写在同一条
batch 里。拆成两条会让用户按两次撤销，而他只做了一个动作。

推挤结果 MUST 来自 core 的同一个网格求解器，MUST NOT 在本包另算一遍——各算一遍的症状是
"拖动时看到的让位与松手后的结果不一样"，而那种偏差只在特定布局下出现。

目标被拖出网格容器时 MUST 删除其 `GridItem` 并按既有的"移出 Layout 时烘焙 Absolute 几何"
规则处理；拖入网格容器时 MUST 按落点写入 `GridItem` 并把 `positioning` 置为 `flow`。

#### Scenario: 拖动写格坐标而不是像素

- **WHEN** 用户把网格里一张 4×2 的卡从 `(8, 0)` 拖到左下方
- **THEN** 提交的命令写的是新的 `GridItem.x` / `y`
- **AND** 该 Entity 的 `LayoutItem.offset` 不变

#### Scenario: 推挤与目标写在同一条事务

- **WHEN** 落点压住了另外两张卡，松手提交
- **THEN** 目标与两张被推卡片的新格坐标在同一条 batch 里
- **AND** 一次撤销让三者同时回到拖动前的位置

#### Scenario: 落点钳制在列范围内

- **WHEN** 用户把一张 4 格宽的卡拖到 12 列网格的最右侧之外
- **THEN** 落点钳制为 `x = 8`
- **AND** 不产生越界的格坐标

#### Scenario: 缩放吸到格线并尊重最小跨度

- **WHEN** 用户拖东侧手柄，指针落在第 8 格与第 9 格之间，且该卡 `minW` 为 2
- **THEN** 宽度吸到整数格
- **AND** 继续向内拖不会让跨度小于 2

#### Scenario: 拖出网格容器时删除 GridItem

- **WHEN** 用户把网格里的一张卡拖到容器之外
- **THEN** 提交的命令删除该 Entity 的 `GridItem` 并把 `positioning` 切为 `absolute`
- **AND** 几何按既有烘焙规则保持视觉位置不变
