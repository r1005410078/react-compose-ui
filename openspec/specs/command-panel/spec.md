# command-panel Specification

## Purpose
TBD - created by archiving change add-command-transaction-runtime. Update Purpose after archive.
## Requirements
### Requirement: 独立结构化命令调试台

系统 MUST 提供可独立安装的 `@compose-ui/command-panel` React 包。`CommandPanel` MUST 订阅宿主
提供的事务运行时，显示当前挂载会话内最近的 committed、noop 与 rejected 命令，不得拥有页面
文档、持久化或运行时全局单例。

#### Scenario: 显示三种命令结果

- **WHEN** runtime 依次发布 committed、noop 和 rejected 事件
- **THEN** 面板按时间显示每种结果、命令 label/type 和 source
- **AND** rejected 项显示稳定错误原因，noop 不伪装成成功事务

#### Scenario: 限制会话事件数量

- **WHEN** 当前挂载期间的命令事件超过默认 100 条
- **THEN** 面板只保留最近 100 条可见事件
- **AND** runtime 的事务历史和文档不受调试台裁剪影响

#### Scenario: 更换运行时

- **WHEN** 宿主为已挂载面板提供另一个 runtime
- **THEN** 面板取消旧订阅并显示新运行时会话事件
- **AND** 旧运行时后续事件不再进入面板

### Requirement: 事务详情

面板 MUST 允许用户展开 committed 事件，查看 transaction ID、source、targetIds、提交时间、
coalesced 状态与 forward/inverse Patch 摘要。详情 MUST 对超长 JSON 使用有界预览，不得执行或
解释其中字符串。

#### Scenario: 查看成功事务

- **WHEN** 用户展开一条 committed 事件
- **THEN** 面板显示该事务的稳定 ID、目标和 Patch 操作摘要
- **AND** JSON 字符串仅作为文本显示

#### Scenario: 查看合并事务

- **WHEN** runtime 发布同一历史事务的 coalesced 更新
- **THEN** 面板更新对应事务项而不是伪造无关事务 ID
- **AND** 详情反映第一次修改前与最后一次修改后的可逆范围

### Requirement: 命令预设表单

`CommandPanel` MUST 接受受控 `CommandPreset` 列表。预设 MUST 使用有限字段描述器表达 string、
number、boolean、select 或 JSON 输入，并在字段有效后由宿主工厂创建 `EditorCommand`。系统
不得提供自然语言解析、eval、动态脚本或隐式网络执行。

#### Scenario: 派发有效预设

- **WHEN** 用户选择预设、填写全部有效字段并提交
- **THEN** 面板通过外部 runtime 派发工厂生成的一个结构化命令
- **AND** 命令 source 默认为 `command-panel`，除非工厂显式提供其他值

#### Scenario: 阻止无效预设输入

- **WHEN** 必填字段缺失、number 非有限、select 不属于候选或 JSON 无法解析
- **THEN** 面板在字段附近显示可访问错误
- **AND** 不调用命令工厂或 runtime dispatch

### Requirement: 调试台可访问性与样式

系统 MUST 提供作用域限定的独立样式入口、键盘可操作的结果列表、表单和详情。包 MUST 将 React
作为 peer dependency，且不得依赖 editor、history、scene-tree、property-panel 或 operation-log。

#### Scenario: 键盘检查并派发命令

- **WHEN** 键盘用户在调试台选择事件、展开详情、切换预设并提交有效表单
- **THEN** 所有操作具有可访问名称、焦点状态和结果反馈
- **AND** 调试台样式不重置宿主全局元素

### Requirement: 命令面板内建本地化

CommandPanel MUST 接受可选 zh-CN 或 en-US locale，并在未提供时保持 zh-CN。标题、状态、详情、
表单验证、空状态和 ARIA 文案 MUST 使用内建词典；命令 label/type、source、字段 label 与 select
选项 MUST 保持宿主值。

#### Scenario: 使用英文命令面板

- **WHEN** 宿主以 en-US 挂载 CommandPanel 并查看事件或预设表单
- **THEN** 内建 chrome、状态、验证和可访问名称显示英文
- **AND** 宿主命令与预设字段文案不被翻译

#### Scenario: 独立使用默认语言

- **WHEN** 宿主独立挂载 CommandPanel 且不提供 locale
- **THEN** 现有简体中文内建文案和派发行为保持不变

### Requirement: ECS 命令调试

Command Panel MUST 展示并重放 v4 Entity、Component、Transform 和 Capability batch 命令，不得
继续提供旧 node/frame 预设。复制 JSON、重放 ID/source 规则和清空会话行为保持不变。

#### Scenario: 查看能力 batch

- **WHEN** Inspector 添加或移除能力
- **THEN** Command Panel 显示一个包含 Component 与 Composition 修改的 committed batch
- **AND** 重放仍产生新 command ID 且遵守当前文档校验

### Requirement: Compose-prefixed Command Panel API
The command panel package MUST expose a compose-prefixed panel and contracts while keeping command validation and
runtime dispatch semantics unchanged.

#### Scenario: Submit a preset
- **WHEN** a user submits a valid command preset in the vNext panel
- **THEN** exactly the same structured command is sent to the dispatch boundary

### Requirement: 命令事件右键菜单

CommandPanel MUST 为会话事件提供详情、复制、确认重放和确认清空菜单。

#### Scenario: 确认重放命令
- **WHEN** 用户确认重放一条命令事件
- **THEN** 面板以新 command ID、command-panel-replay 来源且无 mergeKey 派发命令

#### Scenario: 不显示不存在的命令快捷键
- **WHEN** 用户打开命令事件或空白区域右键菜单
- **THEN** 菜单不显示快捷键后缀，因为命令面板没有对应的键盘动作

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

