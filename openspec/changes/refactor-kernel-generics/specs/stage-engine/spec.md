## ADDED Requirements

### Requirement: 文档无关的交互内核契约

交互内核的会话仲裁、插件注册与插件契约 MUST 对文档类型泛型，MUST NOT 在类型或实现中
引用任何具体文档协议。内核 MUST 通过单一类型级 profile 接收 context、场景索引、事件、
claim 触发事件、效果与快照六个类型，使消费者只声明一个类型参数。

承载这三项契约的模块 MUST NOT import Stage 专有类型；该约束 MUST 由依赖边界测试守住，
而不只是写在文档里。

claim 的触发事件 MUST 由 profile 声明，内核 MUST NOT 硬编码任何事件种类名——命令驱动的
文档类型由键盘而非指针按下发起交互。

Stage 自身的内核类型 MUST 保持既有公共名称，作为 Stage profile 上的别名对外暴露，使既有
插件与消费者无需改动。

#### Scenario: 内核不引用具体文档类型

- **WHEN** 检查仲裁器、插件注册表与插件契约三个模块的 import
- **THEN** 其中不存在对 Stage 专有 context、场景索引、事件、效果或快照类型的引用
- **AND** 依赖边界测试在出现此类引用时失败

#### Scenario: 单一类型参数

- **WHEN** 一个新文档类型要复用内核
- **THEN** 它只需声明一个 profile 绑定六个类型
- **AND** 无需在每个插件、会话与测试夹具的签名上重复这六个类型

#### Scenario: claim 触发事件由 profile 决定

- **WHEN** 某文档类型的交互由键盘命令而非指针按下发起
- **THEN** 该 profile 把 claim 触发事件声明为对应的事件变体
- **AND** 内核不因此需要修改

#### Scenario: Stage 既有名称与行为不变

- **WHEN** 泛型化完成后运行既有的 Stage 交互测试与端到端用例
- **THEN** 18 个插件、Controller 与全部测试的 import 与调用一行未改
- **AND** 手势行为、快照协议与 effect 协议逐项与泛型化之前一致
