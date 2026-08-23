# command-panel 规范增量

## MODIFIED Requirements

### Requirement: 命令动作检索与执行

`@compose-ui/command-panel` MUST 接受宿主提供的 `ComposeCommandAction` 列表，并在面板内提供检索输入框。
`ComposeCommandAction` MUST 由 `@compose-ui/commands` 的 `ComposeCommandDescriptor` 与一个 `run()`
组成：稳定 `id`、已本地化的 `title`，MAY 携带 `aliases`、`category`、`keywords`、展示用 `shortcut` 与
`disabledReason`。面板 MUST NOT 自行定义这半边形状——命令行与面板 MUST 从同一份描述符读取，否则同一条
命令在两个入口会呈现出不同的名称、分组或可用性。

检索匹配 MUST 覆盖 `aliases`：别名是用户在命令行里键入的写法，搜不到它意味着两个入口的词汇表在
用户看来仍是两份。

面板不得自行本地化动作名称，不得注册动作快捷键监听，也不得依赖 `@compose-ui/editor`。

#### Scenario: 空查询保持调试台形态

- **WHEN** 检索输入框为空
- **THEN** 面板不渲染动作结果区
- **AND** 命令事件日志与预设表单的呈现与未接入动作时一致

#### Scenario: 斜杠列出全部动作

- **WHEN** 用户在检索框输入 `/`
- **THEN** 面板列出宿主提供的全部动作
- **AND** 结果按 `category` 分节，未提供 `category` 的动作归入未分组区

#### Scenario: 按关键词过滤

- **WHEN** 用户输入文本，或输入以 `/` 开头的文本
- **THEN** 面板剥离前导 `/` 后对 `title`、`category`、`keywords`、`aliases` 与 `id` 做大小写不敏感匹配
- **AND** 无匹配时显示空结果提示，而不是保留上一次结果

#### Scenario: 按命令行别名检索

- **WHEN** 用户输入一条命令在命令行里的键入写法
- **THEN** 该命令出现在结果中
- **AND** 结果项显示的仍是它已本地化的 `title`

#### Scenario: 执行动作

- **WHEN** 用户选中一条可用动作并确认
- **THEN** 面板调用该动作的 `run()`
- **AND** 面板自身不派发命令、不修改文档，也不解释 `run()` 的副作用

#### Scenario: 不可用动作

- **WHEN** 动作带有非空 `disabledReason`
- **THEN** 该动作在结果中呈现为不可用并展示该原因
- **AND** 点击与键盘确认都不会调用 `run()`
