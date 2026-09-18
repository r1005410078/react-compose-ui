## ADDED Requirements

### Requirement: 多选 Inspector 编辑共有 Renderer 属性

选区里的 Entity **带同一种 Renderer** 时，多选 Inspector MUST 渲染那个 Renderer 自己的
Inspector，字段与编辑器与单选逐字相同，写入作用于整批。

MUST NOT 按 prop 名跨 Renderer 类型取交集：文字的 `color` 与曲线的 `stroke` 不是一件事，
而同名不同义的两个 prop 收进同一个字段，用户读不出自己在改谁。选区里的 Renderer 不止一种
时 MUST 退回「只选中一个才能编辑属性」的空态。

选区里各自取值不同的字段 MUST 呈现为混合，MUST NOT 拿其中一条的值冒充整批。

选区里有**锁定**成员时 MUST 说出有几条不会被写入：静默跳过会让用户以为写进去了，而这正是
「锁形同虚设」的反面错误。全部成员都锁定时该分组 MUST 只读。

#### Scenario: 同一种 Renderer 出完整字段

- **WHEN** 选中 36 条曲线
- **THEN** 多选 Inspector 出「描边」分组，字段与单选一致
- **AND** 改线条颜色一次写入全部 36 条

#### Scenario: 混合类型退回空态

- **WHEN** 选区同时含文字与曲线
- **THEN** 不出任何 Renderer 字段
- **AND** 仍显示「只选中一个才能编辑属性」

#### Scenario: 取值不同的字段呈现为混合

- **WHEN** 选中的曲线线宽分别是 2 与 5
- **THEN** 线条粗细字段标记为多个值
- **AND** 用户写入 3 之后两条都变成 3

#### Scenario: 锁定的成员说出来

- **WHEN** 选区里有 4 条锁定的曲线
- **THEN** 分组里写出这 4 条不会被写入
- **AND** 写入只作用于其余成员
