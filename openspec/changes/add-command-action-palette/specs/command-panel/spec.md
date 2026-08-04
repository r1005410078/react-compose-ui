## ADDED Requirements

### Requirement: 命令动作检索与执行

`@compose-ui/command-panel` MUST 接受宿主提供的 `ComposeCommandAction` 列表，并在面板内提供检索输入框。
动作 MUST 携带稳定 `id`、已本地化的 `title`，MAY 携带 `category`、`keywords`、展示用 `shortcut` 与
`disabledReason`。面板不得自行本地化动作名称，不得注册动作快捷键监听，也不得依赖 `@compose-ui/editor`。

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
- **THEN** 面板剥离前导 `/` 后对 `title`、`category`、`keywords` 与 `id` 做大小写不敏感匹配
- **AND** 无匹配时显示空结果提示，而不是保留上一次结果

#### Scenario: 执行动作

- **WHEN** 用户选中一条可用动作并确认
- **THEN** 面板调用该动作的 `run()`
- **AND** 面板自身不派发命令、不修改文档，也不解释 `run()` 的副作用

#### Scenario: 不可用动作

- **WHEN** 动作带有非空 `disabledReason`
- **THEN** 该动作在结果中呈现为不可用并展示该原因
- **AND** 点击与键盘确认都不会调用 `run()`

### Requirement: 命令检索可访问性

命令检索 MUST 实现 WAI-ARIA Combobox with List Autocomplete 模式：输入框具备 combobox 语义与展开状态，
结果列表具备 listbox 语义，结果项具备 option 语义与选中、禁用状态，活动项通过 `aria-activedescendant`
关联。键盘 MUST 支持上下移动活动项、确认执行与取消。

#### Scenario: 键盘遍历并执行

- **WHEN** 焦点位于检索输入框且结果非空
- **THEN** 上下方向键移动活动项并同步 `aria-activedescendant`
- **AND** 确认键执行当前活动项

#### Scenario: 取消检索

- **WHEN** 用户在检索框按 Escape
- **THEN** 查询被清空且结果区关闭
- **AND** 焦点保留在检索输入框，不逃逸到面板之外

#### Scenario: 检索区本地化

- **WHEN** 宿主提供 zh-CN 或 en-US locale
- **THEN** 检索占位符、空结果提示与未分组区标题使用对应语言
- **AND** 动作 `title` 按宿主提供的原文呈现，不被面板改写
