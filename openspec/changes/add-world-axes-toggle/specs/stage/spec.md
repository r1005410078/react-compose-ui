## ADDED Requirements

### Requirement: 世界坐标轴与原点标记可关

`ComposeStagePolicy` MUST 提供 `worldAxes`（默认 `true`）。为 `false` 时 Stage MUST **既不
绘制两条世界坐标轴、也不绘制原点标记**。

两者 MUST 由**同一个**开关管：它们回答同一个问题——世界原点在哪。只关一半会在画布上留下
一个孤零零的小十字，比两者都在更费解。

关闭 MUST NOT 影响网格、场景边界描边或十字光标：它们各自回答别的问题，其中场景边界还是
用户判断「我这一下点的是场景里面还是工作区空白」所需的信息。

#### Scenario: 关掉坐标轴

- **WHEN** 宿主传 `policy.worldAxes = false`
- **THEN** 画布上没有坐标轴，也没有原点标记
- **AND** 网格与场景边界描边照常绘制

#### Scenario: 缺省仍然显示

- **WHEN** 宿主不传 `policy.worldAxes`
- **THEN** 两条坐标轴与原点标记照常绘制
