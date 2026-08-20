## ADDED Requirements

### Requirement: 可选 Interaction Component

`core` MUST 定义可选的 `Interaction` Entity Component,用于声明该 Entity 在运行期的
trigger 与 action。它 MUST 可以与任意 Entity 组合,MUST NOT 要求 `Renderer`、`Hierarchy`
或任何其他 Component 同时存在。

`Interaction` 的形状 MUST 为 `{ version: 1, triggers: Trigger[] }`。每个 Trigger MUST 含
`event` 与 `action`。v1 MUST 只接受 `event` 为 `'click'`;`action` MUST 是可判别联合,v1
MUST 只接受 `{ type: 'navigate', target: PageReference | null, params?: JsonObject }` 与
`{ type: 'navigate-back' }`。`navigate` 的 `target` MUST 复用既有页面引用值,并 MUST 允许
为 `null` 表示"尚未选择目标"——属性面板新增一条交互时先产生一行,用户才能在这行里挑页面,
不允许 null 会让新建交互与选目标互为前提。**不完整**的引用(缺字段)MUST 仍然被拒绝:
那是配错了,与"还没配"是两回事。运行期 null 目标 MUST 是 no-op。
未知的 `event` 或 `action.type` MUST 在校验时被拒绝而不是静默丢弃。

`triggers` MUST 是数组且同一 `event` MUST NOT 出现多次。空数组 MUST 合法,语义等价于
没有 `Interaction`。`Interaction` MUST NOT 影响布局求解、几何或任何编辑期语义。
不含 `Interaction` 的既有文档 MUST 继续合法且行为不变。

#### Scenario: 任意 Entity 携带 Interaction

- **WHEN** 一个只有 Transform 与 Appearance 的 Entity 加上含 click→navigate 的 `Interaction`
- **THEN** 文档通过校验
- **AND** 该 Entity 的布局与几何求解结果与加上之前完全一致

#### Scenario: 拒绝未知 trigger 与 action

- **WHEN** 文档中的 `Interaction` 含 `event` 为 `'hover'` 或 `action.type` 为 `'open-url'`
- **THEN** 校验以可判别 issue 拒绝该文档
- **AND** 已有的合法 trigger 不被静默保留为部分结果

#### Scenario: 同一事件不重复声明

- **WHEN** `triggers` 中出现两个 `event` 均为 `'click'` 的条目
- **THEN** 校验拒绝该文档

#### Scenario: 目标尚未选择

- **WHEN** `Interaction` 含 `{ type: 'navigate', target: null }`
- **THEN** 文档通过校验
- **AND** 运行期点击该 Entity 不发生跳转

#### Scenario: 空 triggers 合法

- **WHEN** Entity 的 `Interaction.triggers` 为空数组
- **THEN** 文档通过校验且该 Entity 在运行期不接收任何交互

### Requirement: 导航端口协议

`core` MUST 定义导航端口协议 `ComposeNavigationPort`,作为文档运行时与页面导航实现之间
唯一的类型契约。它 MUST 只使用 `core` 已有的页面引用值与纯数据,MUST NOT 引用 React、
DOM 或 `@compose-ui/pages` 中的任何实现类型。

该端口 MUST 至少表达:当前页面 key、是否可返回、按页面引用跳转、返回上一页。跳转与返回
MUST 允许实现为异步。`core` MUST NOT 自带任何导航实现——与 `ComposePageDocumentLoader`
一致,类型在 `core`、实现在 `@compose-ui/pages`、消费在渲染入口。

#### Scenario: 在无 DOM 环境实现端口

- **WHEN** 在没有 React 与 DOM 的运行时中实现 `ComposeNavigationPort`
- **THEN** 实现只需要页面引用值与纯数据即可满足类型
- **AND** 不需要引入任何渲染包

#### Scenario: core 不提供导航实现

- **WHEN** 宿主只依赖 `@compose-ui/core`
- **THEN** 可以获得端口类型但得不到任何可直接使用的导航会话
