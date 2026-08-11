## ADDED Requirements

### Requirement: Renderer 原地文字编辑契约

Registry MUST 支持 Renderer Definition 声明一个可选的原地文字编辑契约，指明承载可编辑纯文本的 value
prop 名称。Registry MUST 校验该名称已在同一 Definition 中声明为 value contract，校验失败 MUST 按既有
Definition 拒绝路径报告稳定错误。Registry MUST 让消费方仅凭 Entity 与 Registry 查出「是否可原地编辑」
与「编辑哪个 prop」，MUST NOT 要求消费方识别具体 Renderer type——Stage 不依赖物料包，不能按物料类型
硬编码。

未声明该契约的 Renderer MUST 保持现状：不提供原地编辑入口，其 props 仍只能由 Inspector 编辑。

#### Scenario: 声明并查询可编辑文本 Prop

- **WHEN** Renderer Definition 把一个已声明的 value prop 标记为原地可编辑文本
- **THEN** Registry 允许注册，且消费方能按 Entity 查到该 prop 名称
- **AND** 未声明契约的 Renderer 查询结果为不可编辑

#### Scenario: 拒绝非法的编辑契约

- **WHEN** Definition 把 method prop、未声明的名称或不存在的 prop 标记为原地可编辑文本
- **THEN** Registry 拒绝该 Definition 并报告稳定错误
- **AND** 其他合法 Definition 不受影响

### Requirement: 原地编辑的运行时值覆盖

编辑期间不产生文档事务，因此编辑中的文本不在 Entity 的 authored props 里。Registry MUST 提供一条
按 Entity 的**编辑中值覆盖**通道，使宿主能在不改文档的前提下，把某个 Entity 可编辑 prop 的当前值
临时覆盖为编辑中的文本。

该覆盖 MUST 同时作用于两处，否则渲染与尺寸会脱节：Renderer 拿到的运行时 props，以及 Renderer
measurement adapter 解析出的测量输入。设置、更新或清除覆盖 MUST 令 measurement revision 前进并使受影响
Entity 的既有缓存条目失效，使 Auto width（Hug）经既有失效链路重新求解，MUST NOT 新增第二条测量通道。

Registry MUST 让 Renderer 得知当前实例是否处于原地编辑，以便以可编辑方式渲染。该编辑态 MUST 只在
`mode` 为 `editor` 时出现。Renderer MUST NOT 借该通道派发文档命令——提交时机由宿主掌握。

覆盖 MUST 是纯运行时状态：文档、历史与 Preview MUST NOT 观察到它，清除覆盖后 Entity MUST 立即回到
authored props 的呈现与尺寸。

#### Scenario: 覆盖值驱动渲染与测量

- **WHEN** 宿主为某 Entity 的可编辑 prop 设置编辑中值覆盖
- **THEN** 该 Renderer 以覆盖值渲染，且 measurement 以覆盖值解析测量输入
- **AND** measurement revision 前进，Auto width 重新求解出与覆盖值一致的宽度

#### Scenario: 清除覆盖回到 authored 值

- **WHEN** 宿主清除该 Entity 的编辑中值覆盖
- **THEN** Renderer 与 measurement 立即回到 authored props 的值
- **AND** 文档、历史与 Preview 全程未观察到覆盖值

#### Scenario: 编辑态只在 editor 模式出现

- **WHEN** 同一个 Entity 分别在 `editor` 与 `preview` 模式下渲染
- **THEN** 只有 `editor` 模式的 Renderer 得知处于原地编辑
- **AND** `preview` 模式不提供任何原地编辑入口
