## ADDED Requirements

### Requirement: 可注入的文档校验器

事务运行时 MUST 通过注入的校验器判定文档合法性，MUST NOT 在实现中硬编码任何具体文档协议
的校验函数。校验器 MUST 同时承担规范化职责：运行时 MUST 采用校验器返回的文档，而不是
送入校验的那一份。

运行时的文档类型、命令 handler、状态快照、事件与 Patch 应用结果 MUST 对文档类型泛型，
且 MUST 以 `ComposeDocument` 为默认类型参数，使既有消费者无需改动。

泛型入口 MUST 要求显式传入校验器；MUST NOT 提供回退到 ComposeDocument 校验器的默认值——
否则为其他文档类型创建运行时时漏传校验器会通过类型检查，却在运行时以无关的校验问题失败。
面向 ComposeDocument 的既有入口 MUST 保持签名不变，作为泛型入口的特化。

#### Scenario: 其他文档类型获得事务与历史

- **WHEN** 一个非 ComposeDocument 的文档类型传入自己的校验器创建运行时
- **THEN** dispatch、Patch 应用、Undo/Redo、历史导航与订阅按既有语义工作
- **AND** 运行时不引用 ComposeDocument 的任何校验规则

#### Scenario: 漏传校验器在类型层被拒绝

- **WHEN** 为非 ComposeDocument 的文档类型调用泛型入口但未提供校验器
- **THEN** 类型检查失败
- **AND** 不存在静默使用 ComposeDocument 校验器的运行时路径

#### Scenario: 采用校验器返回的文档

- **WHEN** 校验器对合法输入返回了规范化后的文档
- **THEN** 运行时保存并对外发布的是规范化后的那一份
- **AND** 后续 Patch 以它为基线

#### Scenario: 既有消费者不受影响

- **WHEN** 现有代码按原样调用面向 ComposeDocument 的运行时入口与类型
- **THEN** 编译通过且行为与注入化之前逐项一致
- **AND** 初始文档非法时仍以配置错误抛出
