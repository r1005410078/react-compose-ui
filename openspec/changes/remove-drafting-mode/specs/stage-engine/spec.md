## ADDED Requirements

### Requirement: 工具集只保留没有别的入口的动作

`StageInteractionTool` MUST 只包含 `select`、`scale`、`rotate` 与各 `draw-*` 绘制工具。
`marquee`、`move`、`pan` 与 `draw-line` 四个值 MUST NOT 存在——它们各自都有严格不弱的既有
入口，留着会让同一个动作有两个不同手感的触发方式。

`pan` 手势插件 MUST 保留，认领条件收缩为「临时平移覆盖或中键」，优先级不变；它是随时可用的
临时覆盖而不是一个要先选中的工具。

`marquee` 与 `move-axis` 两条依赖对应工具值的插件 MUST 随工具值一起退场；空白处拖拽的框选
由 `select` 承担。

#### Scenario: 工具联合不含四个已删值

- **WHEN** 消费方穷举 `StageInteractionTool`
- **THEN** 其中没有 `marquee`、`move`、`pan` 与 `draw-line`

#### Scenario: 中键仍然平移

- **WHEN** 用户按下中键并拖动
- **THEN** 视口平移

#### Scenario: select 空白拖拽仍然框选

- **WHEN** 当前工具是 `select`，用户从空白处按下并拖动
- **THEN** 起一次框选手势
