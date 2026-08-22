## ADDED Requirements

### Requirement: Interaction Component 定义与 Inspector

基础物料包 MUST 为 `Interaction` 注册带 Inspector 的 Component 定义,使用户可以在属性面板中
为**任意** Entity 添加、编辑与移除交互,而不需要该 Entity 是特定物料。Inspector MUST 以
trigger 列表呈现,每行选择事件与动作;动作为 `navigate` 时 MUST 提供页面目标选择,并 MUST
复用既有的 node 属性页面拖入赋值,MUST NOT 另建一套页面选择器。

Inspector MUST 对目标为空、目标页面不存在这两种状态给出明确呈现,并 MUST 允许移除单个
trigger 而不移除整个 `Interaction`。trigger 列表的长度上限 MUST 等于当前支持的事件数量——
文档拒绝重复事件,列表若能加出第二条同事件 trigger,用户只会看到"点了没反应"。
所有编辑 MUST 通过文档命令派发,单次用户操作 MUST 只产生一条可撤销事务;Schema 之外的
字段(如 `action.params`)MUST 在写回时原样保留。

#### Scenario: 给矩形添加跳转

- **WHEN** 用户选中一个 Rectangle 并在属性面板添加 click→navigate 交互
- **THEN** 该 Entity 获得 `Interaction`,`triggers` 含一条 click 条目
- **AND** 撤销一步即回到没有 `Interaction` 的状态

#### Scenario: 拖入页面设置目标

- **WHEN** 用户把资源面板中的页面文件拖到交互行的目标字段
- **THEN** 目标写入该页面的稳定引用
- **AND** 拖入非页面文件时不被接受

#### Scenario: 目标页面缺失

- **WHEN** 已配置的目标页面在当前目录中不存在
- **THEN** Inspector 以明确的错误状态呈现该行
- **AND** 文档中的引用不被自动清空

#### Scenario: 移除 trigger 保留 Component

- **WHEN** 用户移除 Entity 上唯一一条 trigger
- **THEN** 只派发一条命令,`Interaction` 仍然附着且 `triggers` 为空数组
- **AND** 移除整个 `Interaction` 是另一个显式操作

#### Scenario: 不产生重复事件的 trigger

- **WHEN** Entity 已有一条 click trigger,用户再次点击列表的添加入口
- **THEN** 不派发任何命令
- **AND** 文档中的 trigger 数量不变
