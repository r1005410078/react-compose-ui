## MODIFIED Requirements

### Requirement: Auto Layout 按需启用

Container MUST 支持显式启用与移除 Auto Layout。启用 MUST 在一个事务内添加 Layout 并把直接子项
转为 Flow；移除 MUST 把布局结果烘焙回自由布局所需的持久化几何。

启用时若新建 Layout 的 `alignItems` 为 `stretch`、子项 `alignSelf` 为 `auto` 且其交叉轴尺寸模式为
`fixed`，同一条命令 MUST 把该交叉轴改写为 `fill` 并保留原固定值作为回退。改写 MUST 与转 Flow 在
同一命令内完成，否则子项会先以 fixed 尺寸参与一次布局再跳变。

#### Scenario: 单事务添加 Layout 并把直接子项转为 Flow

- **WHEN** 用户在自由 Container 上启用 Auto Layout
- **THEN** 一个事务内添加 Layout 并把全部直接子项转为 Flow
- **AND** 任一受影响子项锁定时不生成命令

#### Scenario: 固定尺寸子项转 Flow 时交叉轴改为 Fill

- **WHEN** 交叉轴为 `fixed`、`alignSelf` 为 `auto` 的子项随容器启用 Auto Layout 转为 Flow
- **THEN** 该子项的交叉轴尺寸模式变为 `fill`，原固定值保留为回退值
- **AND** 主轴尺寸模式保持不变

#### Scenario: 子项显式对齐时不改写尺寸

- **WHEN** 子项 `alignSelf` 不是 `auto`
- **THEN** 其交叉轴尺寸模式保持原样
