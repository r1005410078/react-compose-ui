## ADDED Requirements

### Requirement: 无 React 无 DOM 的命令与键位包

`@compose-ui/commands` MUST 是无 React、无 DOM 的独立包，MUST NOT 依赖 `core`、任何 UI
Context 或任何领域包——动作只是 `run(ctx)`，本包 MUST NOT 认识任何文档协议。

本包 MUST 同时承载键位的类型、归一化、序列化、事件匹配与平台格式化五项能力。这五项属于
同一件事，分散在不同包时任何一个包都无法独立完成「一次按键命中了哪个动作」或「两个动作
是否撞键」的判定。

事件匹配 MUST 接受结构化的事件形状而非 DOM 事件类型；平台格式化 MUST 把平台作为必填参数
接收，MUST NOT 在包内读取 `navigator`。

#### Scenario: 包边界

- **WHEN** 检查 `@compose-ui/commands` 的依赖与源码
- **THEN** 不存在对 React、DOM 全局或任何 `@compose-ui/*` 包的依赖
- **AND** 该约束由依赖边界测试守住

#### Scenario: 五项能力同处一包

- **WHEN** 一个消费者要判定某次按键命中了哪个动作
- **THEN** 归一化、匹配与动作查表都来自本包，无需再依赖第二个包
- **AND** 检测两个动作是否撞键同样只依赖本包

#### Scenario: 格式化不读取平台全局

- **WHEN** 在没有 `navigator` 的环境中格式化键位
- **THEN** 调用方传入平台字符串即可得到确定结果
- **AND** 包内不出现对 `navigator` 的读取

### Requirement: 单一权威的键位定义

`ComposeKeybinding` MUST 只在 `@compose-ui/commands` 中定义一次。其他包对外暴露的键位类型
MUST 是该定义的别名或转导，MUST NOT 各自重新声明结构相同的类型。

归一化 MUST 拒绝空 code，MUST 拒绝同时要求 `primary` 与显式 `control`，并 MUST 剔除取值为
假的修饰键字段，使序列化结果可用于相等判定。

#### Scenario: 别名而非重复定义

- **WHEN** 检查 `components`、`stage` 与 `editor` 暴露的键位类型
- **THEN** 三者都解析到同一个定义
- **AND** 既有的公共类型名称与消费者代码保持不变

#### Scenario: 归一化拒绝非法组合

- **WHEN** 归一化一个同时要求平台主修饰键与显式 Control 的键位
- **THEN** 抛出配置错误
- **AND** 空 code 同样被拒绝

### Requirement: 动作到键位的共享映射

动作 id 到键位列表的映射 MUST 由本包提供泛型容器与操作，使不同的动作 id 集合共用同一套
归一化、去重、冲突检测与命中解析。

同一份默认键位 MUST NOT 在两个包中各写一遍。当一个包的动作集合是另一个包的超集时，
超集一方 MUST 由子集一方的表展开得到，只补充自己独有的条目。

#### Scenario: 默认键位不重复维护

- **WHEN** 修改一个同时属于 Stage 与 Editor 的动作的默认键位
- **THEN** 只需改一处
- **AND** 两个包读到的默认值必然一致，而不依赖人工同步

#### Scenario: 冲突检测

- **WHEN** 在同一作用域内为两个动作配置了相同键位
- **THEN** 冲突检测报告出另一个动作
- **AND** 判定基于归一化后的序列化结果，修饰键书写顺序不影响判定
