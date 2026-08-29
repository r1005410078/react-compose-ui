## ADDED Requirements

### Requirement: 取点提示可声明数值参数化

`ComposeCommandPrompt` MUST 接受可选的 `fields`，声明这一步的两个数值字段怎么参数化：

| 值 | 两个字段 | 原点 |
| --- | --- | --- |
| `absolute` | X、Y | 无（世界坐标） |
| `polar` | 距离、角度 | 上一个点 |
| `cartesian` | 宽、高 | 上一个点 |

**原点 MUST NOT 出现在 `fields` 里**：它就是会话已经上报的那个 `reference`（橡皮筋的起点），
把同一个点放进两个地方只能靠约定保持一致。

字段 MUST 可选：不声明的步骤（选择对象、取基点）不显示数值，行为与从前完全一致。本包
MUST NOT 实现任何字段数学——它零运行时依赖，连坐标都不认识；`fields` 只是一个标签，由宿主
解释。

#### Scenario: 缺省时不影响既有命令

- **WHEN** 一条命令的提示不声明 `fields`
- **THEN** 会话行为与未引入该字段时完全一致

#### Scenario: 声明极坐标参数化

- **WHEN** `LINE` 取过第一个点
- **THEN** 「指定下一点」这一步的 `fields` 是 `polar`
