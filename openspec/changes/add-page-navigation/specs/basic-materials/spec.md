## ADDED Requirements

### Requirement: Interaction Component 定义与 Inspector

基础物料包 MUST 为 `Interaction` 注册带 Inspector 的 Component 定义,使用户可以在属性面板中
为**任意** Entity 添加、编辑与移除交互,而不需要该 Entity 是特定物料。Inspector MUST 以
trigger 列表呈现,每行选择事件与动作;动作为 `navigate` 时 MUST 提供页面目标选择,并 MUST
复用既有的 node 属性页面拖入赋值,MUST NOT 另建一套页面选择器。

Inspector MUST 对目标为空、目标页面不存在这两种状态给出明确呈现,并 MUST 允许在不清空
其他 trigger 的前提下移除单个 trigger。所有编辑 MUST 通过文档命令派发,单次用户操作
MUST 只产生一条可撤销事务。

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

#### Scenario: 移除单个 trigger

- **WHEN** Entity 含两条 trigger 且用户移除其中一条
- **THEN** 另一条保持不变
- **AND** 只派发一条命令
