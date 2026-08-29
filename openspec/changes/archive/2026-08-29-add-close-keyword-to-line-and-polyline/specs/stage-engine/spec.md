## ADDED Requirements

### Requirement: 连续取点命令的闭合关键字

`LINE` 与 `PLINE` MUST 各提供一个 `C` 闭合关键字，语义都是「回到第一个点并结束」，
但机制随各自的落地方式不同：

- `LINE` 逐段落地，因此 `C` MUST 再产出**一段**从当前点回到第一个点的线，然后结束会话。
- `PLINE` 攒到结束才提交，因此 `C` MUST 把 `closed` 置为 `true` 并提交那一个 Entity。

**闭合本身就是结束信号**，两条命令在 `C` 之后 MUST NOT 再等下一个点。

关键字 MUST 只在**够得着闭合**时出现在提示里：`LINE` 至少取过两个点、`PLINE` 至少取过三个
顶点。不够时列出它等于让用户看见一个按下去只会被拒绝的选项。

顶点全部重合这类退化情形 MUST 与既有的结束路径同样处理（什么都不提交），MUST NOT 因为走了
`C` 而绕过退化判定。

#### Scenario: LINE 闭合补上收尾那一段

- **WHEN** `LINE` 依次取三个点后键入 `C`
- **THEN** 产出的线段共四段，最后一段从第三点回到第一点
- **AND** 会话结束

#### Scenario: PLINE 闭合置位并提交

- **WHEN** `PLINE` 依次取三个点后键入 `C`
- **THEN** 只产出一个 Entity，其 `Curve` 的 `closed` 为 true，顶点仍是三个
- **AND** 会话结束

#### Scenario: 顶点不够时没有闭合关键字

- **WHEN** `PLINE` 只取过两个点
- **THEN** 提示里没有闭合关键字
- **WHEN** 此时仍然键入 `C`
- **THEN** 会话给出被拒绝的说明并停在原提示
