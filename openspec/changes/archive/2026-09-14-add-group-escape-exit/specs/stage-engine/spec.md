## ADDED Requirements

### Requirement: Escape 退出分组的解算

`stage-engine` MUST 提供一个纯函数解算（`resolveStageGroupExit`），求当前选区**共同**的最近
first-class Group 严格祖先：选区里每一项各取最近的 Group 祖先，全部相同时返回它，否则返回
`null`。复合地址（实例内部）MUST 按宿主实例算；已不在文档中的 ID MUST NOT 参与；选区为空
MUST 返回 `null`。

#### Scenario: 单选回到上一层

- **WHEN** 选区是 `outer(Group) › inner(Group) › leaf` 里的 `leaf`
- **THEN** 解算结果是 `inner`；选区是 `inner` 时结果是 `outer`

#### Scenario: 没有更外层的 Group

- **WHEN** 选区是 `outer` 或一个不在任何 Group 里的对象
- **THEN** 解算结果是 `null`

#### Scenario: 多选只认共同的最近 Group

- **WHEN** 选区是 `inner` 与 `sibling`（都直接在 `outer` 里）
- **THEN** 解算结果是 `outer`
- **AND** 选区是 `leaf` 与 `sibling` 时结果是 `null`
