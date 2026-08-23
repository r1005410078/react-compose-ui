# commands 规范增量

## ADDED Requirements

### Requirement: 命令的可呈现信息与可用性

系统 MUST 把一条命令的**可呈现信息**独立成 `ComposeCommandDescriptor`：稳定 `id`、可键入的
`aliases`、已本地化的 `title`，以及可选的 `category`、`keywords`、展示用 `shortcut` 与
`disabledReason`。`ComposeCommandDefinition` MUST 继承它。

描述符 MUST NOT 携带 `TContext` / `TEffect` 泛型：只列出与检索命令的消费者不应被它永远不使用
的两个类型参数传染。

`disabledReason` 非空 MUST 表示该命令此刻不能执行；它是**已本地化的文案**，本包 MUST NOT
认识界面语言，翻译由产出描述符的一方完成。

可用性 MUST 是描述符自身的字段，MUST NOT 做成注册表上的查询：列出命令的一方拿到的是一份
描述符列表而不是注册表，做成查询会让两处各自判断而漂移。

#### Scenario: 描述符不带泛型

- **WHEN** 消费者只需要列出与检索命令
- **THEN** 它可以只依赖 `ComposeCommandDescriptor`
- **AND** 不需要给出效果类型或上下文类型

#### Scenario: 不可用的命令带出原因

- **WHEN** 一条命令此刻不满足执行前提
- **THEN** 它的描述符携带非空 `disabledReason`
- **AND** 该文案由产出方给出，本包不改写也不翻译

### Requirement: 一次性动作是命令会话的退化情形

系统 MUST 提供把**一次性动作**（一个稳定标识加一个立即执行的函数）包装成命令定义的入口，
产出的会话 MUST `prompt` 为 `null` 并在收到确认时提交。一次性动作 MUST NOT 成为与命令定义
并列的第二种形状——它表达不了多步，而命令定义表达得了一步。

系统 MUST 提供**唯一一处**跑退化会话的实现：启动会话，`prompt` 为 `null` 时立即以确认推进，
否则报告该命令需要进一步输入而不推进。消费者 MUST NOT 各自内联这一段。

#### Scenario: 退化命令一次确认即提交

- **WHEN** 消费者启动一条由一次性动作包成的命令
- **THEN** 会话的 `prompt` 为 `null`
- **AND** 以确认推进后返回提交状态，动作的副作用已经发生

#### Scenario: 需要输入的命令不被立即跑掉

- **WHEN** 消费者对一条多步命令调用立即执行入口
- **THEN** 返回「需要进一步输入」而不是提交
- **AND** 会话没有被推进
