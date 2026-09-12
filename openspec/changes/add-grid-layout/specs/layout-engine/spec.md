## ADDED Requirements

### Requirement: 网格容器的预解算

Layout Runtime MUST 在把样式写进 Yoga 之前，为每个 `type: 'grid'` 的容器跑一趟网格预解算：
读容器的 Layout 与各 Flow 子级的 `GridItem`，经 core 的网格求解器算出每个子级相对容器内容盒
的绝对矩形，再把该子级作为**绝对定位**节点喂给 Yoga（显式 position 与 width / height）。

列宽 MUST 由容器**内容盒**宽度推出（已扣除边框与内边距），因此预解算 MUST 排在容器自身尺寸
可知之后。容器为 Hug 时其内容高度 MUST 取网格解算出的总行高（含行间距与内边距）。

格中子级的 `LayoutItem.width` / `height` MUST NOT 参与求解——盒就是格矩形。其 `mode` 取值
MUST 被忽略而不是拒绝：切换布局类型是一次编辑，中间态不应让求解失败。

Snapshot 的 box MUST 与 flex 子级同形，订阅方 MUST NOT 需要区分两者。Yoga 对象仍
MUST NOT 进入公共 API。

#### Scenario: 格坐标解成绝对矩形

- **WHEN** 一个 12 列、行高 48、间距 6 的网格容器里有一张 `{x: 4, y: 0, w: 4, h: 2}` 的卡
- **THEN** Snapshot 里该卡的 box 左边等于内容盒左边加四个列步长，高度等于两行加一个行间距
- **AND** 该 box 与 flex 子级的 box 在结构上没有区别

#### Scenario: Hug 容器的高度由行数决定

- **WHEN** 网格容器高度为 Hug，其中最下面一张卡占到第 5 行
- **THEN** 容器内容高度等于 6 行加 5 个行间距
- **AND** 卡片被删除导致行数减少时，容器在下一次求解后收缩

#### Scenario: 忽略格中子级的轴尺寸模式

- **WHEN** 格中子级的 `LayoutItem.width.mode` 是 `fill` 或 `hug`
- **THEN** 求解仍按格矩形给出盒，不产生诊断也不失败

#### Scenario: 容器变宽时列宽跟着变

- **WHEN** 网格容器的宽度从 752 改为 900，列数与行高不变
- **THEN** 每张卡的宽度按新列宽重新解出，格坐标与行高不变
