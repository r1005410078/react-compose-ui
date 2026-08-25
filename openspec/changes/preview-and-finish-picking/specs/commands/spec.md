# 命令引擎规范增量

## ADDED Requirements

### Requirement: 命令会话可以被问「落在这里会是什么样」

`ComposeCommandSession` MUST 支持可选查询 `preview(point)`：给一个候选落点，返回这一步**如果**
在那里落笔的效果，`null` 表示这一步没有可呈现的内容。

它 MUST 是**查询**而不是状态推进：MUST NOT 改变会话状态，MUST NOT 产生事务，MUST 可以每帧
调用任意多次而不影响随后的 `advance`。把光标位置做成第五种输入是错的——`advance` 是状态机，
每帧一次 `pointermove` 就推进一次会让「取了几个点」跟着鼠标动，而撤销、关键字与提示都挂在
那个计数上。

它 MUST 可选：本包零运行时依赖且对效果类型泛型，既有的宿主注入命令 MUST NOT 因为新增一个
呈现能力而全部需要改动。未实现时宿主 MUST 退回既有呈现。

#### Scenario: 查询返回候选结果

- **WHEN** 一条已取过点的会话被以候选落点查询
- **THEN** 返回的效果描述「如果在这里落笔」的完整结果

#### Scenario: 查询不推进会话

- **WHEN** 对同一条会话连续查询若干次后再 `advance`
- **THEN** `advance` 的结果与从未查询过时完全一致

#### Scenario: 未实现查询的会话照常工作

- **WHEN** 宿主注入的命令没有实现该查询
- **THEN** 启动、推进与结束的行为与本增量之前完全一致
