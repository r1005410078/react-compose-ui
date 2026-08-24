## MODIFIED Requirements

### Requirement: 命令行是共享 Pattern

命令行 MUST 作为无业务语义的 Pattern 住在 `@compose-ui/components`。它只消费命令提示与一组
注入的文案，MUST NOT 认识文档协议、选择集或任何具体命令；各不相同的状态标记 MUST 以
`status` 传入，`data-testid` 前缀 MUST 由调用方给出。

组件 MUST 把提示与关键字渲染成 `提示或 [放弃(U)/结束(F)]:` 的形式——括号里的字母就是用户要
键入的内容，这个格式本身在告诉用户怎么操作。文案 MUST 由调用方注入，MUST NOT 在包内硬编码。

Enter MUST 上报提交的文本，Esc MUST 上报取消；两级语义（中止命令还是清空选择）由宿主判定，
组件只负责把按键报上去。

本 Pattern **目前只有一个消费者**。`@compose-ui/components` 的准入规则「已经被至少两个第一方
包复用」挡的是**提前抽象**，而本 Pattern 抽取时确有两个消费者；消费者减少 MUST NOT 被追溯
地当成当初抽取有误，也 MUST NOT 作为把它搬回宿主包的理由。

#### Scenario: 渲染提示与关键字

- **WHEN** 传入带关键字的提示
- **THEN** 渲染出提示文本与括号中的可键入字母

#### Scenario: 空闲态

- **WHEN** 没有活动提示
- **THEN** 渲染就绪文案

#### Scenario: 提交与取消

- **WHEN** 用户键入文本并回车、随后按 Esc
- **THEN** 依次上报提交的文本与取消，组件自身不解释其含义
