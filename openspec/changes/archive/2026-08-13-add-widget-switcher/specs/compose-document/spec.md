## ADDED Requirements

### Requirement: 可选 WidgetSwitcher Component

ComposeDocument v6 MUST 支持可选内建 Component `WidgetSwitcher`，字段只有 `activeIndex: number`。
它 MUST 只在同时拥有 `Hierarchy` 的 Entity 上具有意义，MUST NOT 成为任何 Entity 的必需 Component，
因此 MUST NOT 触发文档版本变更或迁移。

Core MUST 提供纯函数解析活动子项：读取时 MUST 把 `activeIndex` 钳制到 `[0, childIds.length - 1]`，
子项为空时 MUST 返回 `null`。删除或新增子项 MUST NOT 顺带改写 `activeIndex`——钳制只发生在读取侧。

Core MUST 提供纯函数派生「本次渲染应跳过的 Entity ID 集合」，覆盖文档中全部 switcher 的非活动直接
子项。该函数 MUST 是 Stage、Preview、嵌套文档 Runtime 与 SceneIndex 的唯一事实来源。非活动子项
MUST NOT 通过写入 `Visibility` 来隐藏，`Visibility` 保留表达用户的显式意图。

#### Scenario: 索引越界钳制

- **WHEN** `activeIndex` 为 5 而 switcher 只有 2 个子项
- **THEN** 活动子项解析返回最后一个子项
- **AND** 文档中的 `activeIndex` 保持为 5 不被改写

#### Scenario: 空 switcher

- **WHEN** switcher 的 `childIds` 为空
- **THEN** 活动子项解析返回 `null`
- **AND** 隐藏集合中不包含任何 Entity

#### Scenario: 只隐藏非活动直接子项

- **WHEN** 从含 switcher 的文档派生隐藏集合
- **THEN** 集合包含该 switcher 除活动子项外的全部直接子项
- **AND** 不包含活动子项、不包含非 switcher 容器的任何子项
- **AND** 不写入或读取任何 Entity 的 `Visibility`

#### Scenario: 预览覆盖优先于活动索引

- **WHEN** 派生隐藏集合时为某个 switcher 指定了预览子项
- **THEN** 该 switcher 只显示预览子项，其余直接子项进入隐藏集合
- **AND** 其他 switcher 仍按各自的 `activeIndex` 解析
