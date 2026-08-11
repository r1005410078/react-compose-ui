# component-registry Specification

## Purpose
TBD - created by archiving change add-infinite-stage-composition. Update Purpose after archive.
## Requirements
### Requirement: Renderer 资源解析上下文

RegistryComponent MUST 把可选 assetResolver 传给 definition renderer；省略 resolver 时原有
definition 行为 MUST 保持不变。

#### Scenario: 独立组件无 Resolver

- **WHEN** 非资源 definition 或旧宿主未提供 assetResolver
- **THEN** renderer 继续正常渲染

### Requirement: 独立 ComposeEntityRegistry

系统 MUST 用实例级 ComposeEntityRegistry 统一注册 Renderer Definition、Component Definition、
Entity Preset 与 Capability Definition。Registry MUST 保持有序、不可变和实例隔离，并拒绝空 ID、
重复 ID、非法默认 JSON、重复 Capability 所有权及依赖循环。

#### Scenario: 创建有序 ECS Registry

- **WHEN** 宿主提供合法 Renderer、Component、Preset 和 Capability definitions
- **THEN** Registry 可按稳定 ID 读取并按注册顺序列出每一类定义
- **AND** 外部数组修改不会改变 Registry

#### Scenario: 拒绝非法能力图

- **WHEN** Capability 依赖循环、拥有重复 Component Key 或引用未知依赖
- **THEN** Registry 创建明确失败且不产生部分实例

### Requirement: Entity Preset 创建

Entity Preset MUST 返回独立 Component JSON。Registry MUST 校验组合、自动写入 Composition，
并把初始 Keys 记录为 baseComponentKeys；Palette 图标和 factory 不得写入文档。

#### Scenario: 创建独立 Entity seeds

- **WHEN** 连续两次创建同一 Rectangle Preset
- **THEN** 两份 seeds 业务值相同但不共享嵌套 JSON
- **AND** Composition 记录 Preset ID 和各自基础 Keys

### Requirement: Renderer 与 Component Inspector

Registry MUST 允许 Renderer Definition 提供无 Scene DOM 依赖的 measurement definition，包含同步
measure、可选异步 prepare 与 baseline。Registry MUST 保持 definition 实例隔离，并且消费方 MUST 把 invalid/throwing measurement 隔离为
可恢复失败而不是破坏 Renderer 渲染。

#### Scenario: 自定义 Renderer 提供 Hug 测量
- **WHEN** 宿主 Renderer 注册 measurement 并在 Exactly、AtMost、Undefined 约束下返回尺寸
- **THEN** Registry measurement adapter 向 Layout Runtime 提供同步缓存结果与可选 baseline
- **AND** prepare 被取消、迟到或抛错时只返回 fallback 状态并允许后续 revision 恢复

### Requirement: 未知 Definition 降级

Registry 消费方 MUST 为未知 Component、Capability 和 Renderer 显示包含稳定 ID 的可访问占位，
并 MUST 保留原始 JSON。

#### Scenario: 缺失插件后打开文档

- **WHEN** 文档包含当前 Registry 未注册的合法 Component、Capability 或 Renderer
- **THEN** Stage/Preview/Inspector 只降级对应区域
- **AND** 其他 Entity 与编辑操作保持可用

### Requirement: Capability 规划

Registry MUST 计算可添加、冲突、依赖和可移除状态。添加 MUST 自动补齐依赖且不得覆盖已有未知
Component；移除 MUST 阻止基础项、依赖方、缺失定义和含子项 Container，不得级联删除。

#### Scenario: 添加容器与几何限制

- **WHEN** 用户给 Renderer Entity 添加内建容器或几何限制
- **THEN** Registry 分别规划 Hierarchy+Clip 或 TransformConstraints 的原子 batch

#### Scenario: 阻止危险移除

- **WHEN** 能力仍被依赖、定义缺失、拥有基础 Component 或 Container 含有子项
- **THEN** 移除入口禁用并返回可读原因

### Requirement: 能力可用性携带移除可行性

listCapabilityAvailability MUST 对已附加能力返回与 planRemoveCapability 同一套阻塞规则
（锁定、定义缺失、被依赖、基础项、含子项容器）的 disabled 状态与稳定 issue，
消费方 MUST NOT 需要额外调用移除规划来推导按钮状态。

#### Scenario: 已附加能力被依赖时禁用移除

- **WHEN** Entity 附加了 container 与依赖它的 geometry 能力
- **THEN** availability 中 container 项 disabled 为 true 且 issue.code 为 capability.required

#### Scenario: 锁定 Entity 禁用全部能力操作

- **WHEN** Entity 的 Lock.locked 为 true
- **THEN** availability 中已附加与未附加项都 disabled 且 issue.code 为 capability.locked

### Requirement: 定义错误边界在数据修复后恢复

Renderer 与 Inspector 错误边界 MUST 在 identity 或输入数据引用变化时清除失败状态并重试渲染。

#### Scenario: 修复坏 props 后恢复渲染

- **WHEN** 宿主 Renderer 因坏 props 抛错后文档中的 Renderer 数据被修复
- **THEN** Stage 恢复渲染宿主内容而不再显示失败占位

### Requirement: Stage 与 Preview 共享 Entity 视觉样式

系统 MUST 提供 composeEntityVisualStyle 与 composeEntitySceneStyle，把 Appearance、Clip 与
Transform 解析为一致的盒样式；Stage 与 Preview MUST 使用同一实现渲染 Entity 盒。

#### Scenario: 边框与阴影合成一致的 boxShadow

- **WHEN** Entity Appearance 同时含边框与 shadow
- **THEN** 两个消费方得到相同的 inset 边框加投影 boxShadow 与 Clip 决定的 overflow

### Requirement: Compose-prefixed Registry React bridge
The component registry MUST expose compose-prefixed factory and renderer bridge names while preserving its headless
registry protocol and renderer error handling.

#### Scenario: Render registered component
- **WHEN** a consumer renders a registered component through the vNext bridge
- **THEN** renderer props, error boundaries and inspector dispatch retain their current semantics

### Requirement: 共享 Entity Paint Layer 与 Inspector Port

Registry MUST 提供 Stage 与 Preview 共用的 Entity Paint layer。Solid、Linear、Radial、Angular 必须从同一 Core Paint descriptor 渲染，且 layer 不影响 Renderer 或 Hierarchy 子项的 pointer 目标。Registry MUST 定义无 Editor/Stage 依赖的 ComposePaintEditPort，供 Component Inspector 请求激活、退出和采样背景 Paint。

#### Scenario: Stage 与 Preview 渲染同一 Paint

- **WHEN** Entity 使用任意支持的 backgroundPaint
- **THEN** Stage 与 Preview 使用相同 descriptor 和视觉渐变
- **AND** Inspector 只能通过 Port 发出 Paint 编辑意图

### Requirement: 页面节点端口透传

Component Registry MUST 在 Renderer 与 Component Inspector 的渲染上下文中透传两个可选宿主端口：
供 Inspector 编辑节点引用属性的节点 editor 端口，以及供 Renderer 加载页面文档的页面文档加载端口。
两个端口 MUST 以纯协议类型声明，Registry MUST NOT 解释其领域含义，也 MUST NOT 因此新增对
`asset-browser`、`editor`、`property-panel` 或 `preview` 的依赖。端口缺省时 Registry MUST 正常渲染。

#### Scenario: 端口到达 Inspector 与 Renderer

- **WHEN** 宿主向 Registry 渲染上下文注入节点 editor 端口与页面文档加载端口
- **THEN** 对应的 Component Inspector 与 Renderer 都能取到这两个端口
- **AND** 端口对象在多次渲染间保持引用稳定

#### Scenario: 端口缺省

- **WHEN** 宿主未注入这两个端口
- **THEN** Renderer 与 Inspector 正常渲染
- **AND** 依赖端口的能力以可访问的未配置状态呈现

### Requirement: Component Inspector 标题栏 actions

ComposeComponentDefinition MUST 支持可选的 inspectorHeaderActions Renderer。Registry MUST 提供与
Component Inspector 正文相同的受控上下文和错误隔离适配器，使 Editor 可以按协议组合标题栏内容，
而不识别具体 Component Key。

#### Scenario: 解析 Component 标题栏 actions

- **WHEN** 当前 Entity 拥有一个声明 inspectorHeaderActions 的已注册 Component
- **THEN** Registry 适配器向 actions Renderer 传入 entity、componentKey、value、dispatch 和只读状态
- **AND** 未声明 actions、缺少 Component 数据或 actions 渲染失败时不会卸载完整 Inspector

### Requirement: 可释放的 Registry Measurement Adapter

系统 MUST 提供把 registry、asset resolver、page loader 与 browser measurement environment 组合为
core measurement port 的 adapter。Adapter MUST 缓存、订阅、取消、丢弃迟到结果并在 dispose 后停止通知。

#### Scenario: 资源 revision 使测量失效
- **WHEN** Image、SVG 或 Page Renderer 的稳定引用发布新资源/page revision
- **THEN** adapter 重新 prepare 对应 Entity 并发布精确 invalidation
- **AND** 旧 Promise 结果、旧 Blob 和已取消订阅不能覆盖新缓存

### Requirement: 缺失 Component Inspector 协议

Component Definition MUST 能够声明 Component 缺失时的 Inspector 标题栏操作、可选引导正文与
可见条件。Editor MUST 按 Registry 顺序组合该协议，不得硬编码具体 Component Key；锁定、文档、
LayoutSnapshot 与 dispatch MUST 使用和普通 Component Inspector 相同的上下文。没有引导正文的
定义 MUST 继续呈现 action-only 分组；拥有引导正文的定义 MUST 呈现可折叠分组。

#### Scenario: Hierarchy 缺少 Layout 时显示入口

- **WHEN** Materials 的 Layout Definition 检查拥有 Hierarchy 但缺少 Layout 的 Entity
- **THEN** Inspector 在 Layout 的 Registry 顺序位置显示可折叠“布局”分组、标题操作与引导正文
- **AND** 非 Hierarchy Entity 与已经拥有 Layout 的 Entity 不显示重复入口

#### Scenario: 宿主缺失入口保持 action-only

- **WHEN** 宿主 Component 的 missing Inspector 只声明标题栏操作而没有引导正文
- **THEN** Editor 继续显示不可折叠且无正文的 action-only 分组
- **AND** 不渲染空正文或伪造宿主领域文案

#### Scenario: 缺失入口继承只读上下文

- **WHEN** Entity 已锁定或宿主 Inspector 为只读
- **THEN** 缺失 Component 的操作收到 readOnly 状态并保持禁用
- **AND** Editor 不创建任何 Component 命令

### Requirement: Component Inspector 分组与默认展开协议

Component Definition MUST 能够声明将已存在 Component 的 Inspector 合并进基础分组，并且 Component
与 Renderer Definition MUST 能够声明独立分组是否默认展开。Editor MUST 通过 Registry 元数据组合
分组，不得按具体 Component Key 硬编码编辑 UI。

#### Scenario: 合并基础 Component Inspector

- **WHEN** LayoutItem Definition 声明 `inspectorGroup: 'basic'` 并提供复合几何 Inspector
- **THEN** 复合 Inspector 按 Registry 顺序渲染在 Identity 之后的同一“基础”分组中
- **AND** Transform 不再创建独立 Inspector，Editor 也不再为 Transform 或 LayoutItem 创建独立顶级分组

#### Scenario: 应用默认展开状态

- **WHEN** Layout 声明默认展开而其他普通 Component/Renderer 分组未声明展开
- **THEN** 基础与 Layout 默认展开，其余分组默认折叠
- **AND** 搜索命中仍临时显示并展开对应分组

### Requirement: Renderer Prop Contract

Renderer Definition MUST 能够以实例级 Prop Contract 声明顶层可绑定 Prop。value contract MUST 提供
稳定名称、显示名、纯同步 validator 与可选 measurement 影响标记；method contract MUST 声明
`event-handler` 角色。全部已声明 Contract MUST 默认可绑定。Definition MAY 声明唯一、非空的 Props 分类，
Contract MAY 引用一个已声明分类；Registry MUST 拒绝无效分类和未知分类引用，未引用分类的 Contract 由
Editor 消费为隐式「高级」。Definition MAY 声明由自定义 Inspector 内联呈现的 value Prop 名称，Registry
MUST 校验这些名称存在、属于 value Contract 且 Inspector 存在；Editor 请求分类内容时 MUST 把当前分类
透传给 Inspector。Registry MUST 保持无 Valibot 依赖，隔离 validator 异常，并让未声明 Contract 的既有
Renderer 继续使用字面 Props 且不出现正式绑定入口。

#### Scenario: 注册值与事件方法 Props

- **WHEN** Renderer Definition 声明 number value Prop 和 event-handler method Prop
- **THEN** Registry 按稳定 Prop 名称返回两类 Contract
- **AND** Definition、Contract 与 validator 保持实例隔离

#### Scenario: 校验 Inspector 内联 Prop

- **WHEN** Renderer 把一个 method、未知名称或没有 Inspector 的 value Prop 声明为 Inspector 内联字段
- **THEN** Registry 拒绝该 Definition 并报告稳定错误
- **AND** 合法但未内联的 Contract 继续由消费方显示 binding-only 入口

#### Scenario: 校验 Props 分类归属

- **WHEN** Renderer 声明重复或空分类，或 Prop Contract 引用未声明分类
- **THEN** Registry 拒绝该 Definition 并报告稳定错误
- **AND** 省略 category 的合法 Contract 保持未分类，由 Editor 放入「高级」

#### Scenario: 旧 Renderer 没有 Prop Contract

- **WHEN** 宿主继续注册只包含 type、label 与 renderer 的旧 Definition
- **THEN** Registry 正常渲染其 authored Props
- **AND** 不推断 TypeScript 类型或自动暴露任意 Prop 绑定

### Requirement: Authored 与 Runtime Props 分离

Registry Renderer bridge MUST 同时提供严格 JSON authored Props 与应用有效绑定后的 runtime Props。
`props` MUST 表示 Renderer 实际消费的 runtime 对象并允许包含 Function，`authoredProps` MUST 保持为
文档 `Renderer.props` 的只读 JSON。绑定解析 MUST NOT 修改 Entity 或 authored Props。

#### Scenario: 值绑定覆盖字面 Prop

- **WHEN** 页面 value export 通过目标 Contract validator
- **THEN** renderer props 使用当前导出值且 authoredProps 保留文档字面值
- **AND** 导出更新只发布运行快照而不产生文档事务

#### Scenario: 值绑定失败回退字面 Prop

- **WHEN** 返回成员缺失、kind 不匹配、validator 拒绝或脚本作用域失败
- **THEN** runtime props 使用同名 authored Prop 并发布目标 diagnostic
- **AND** 其他有效绑定继续生效

#### Scenario: 方法绑定注入事件 wrapper

- **WHEN** method export 绑定到 event-handler Contract
- **THEN** Preview runtime props 包含保留调用参数且忽略返回值的方法 wrapper
- **AND** Function 不出现在 authoredProps、Entity JSON 或 Registry 快照序列化中

### Requirement: 响应式 Prop 测量失效

Registry measurement adapter MUST 在绑定 value export 改变且对应 Contract 可能影响测量时使精确 Entity
失效。value contract 只有显式声明 `affectsMeasurement: false` 才能跳过；method export 调用或状态不变
MUST NOT 使 Layout Runtime 失效。

#### Scenario: 文本绑定变化重新测量 Hug

- **WHEN** Hug Text 的绑定 value export 从短文本变为长文本
- **THEN** adapter 只使该 Entity 的 measurement 与 Layout Snapshot 失效
- **AND** 新布局完成前继续遵守现有 fallback 与 diagnostic 规则

#### Scenario: 方法调用不直接触发布局

- **WHEN** 用户调用一个绑定 method 且它没有修改任何影响测量的 State export
- **THEN** Layout Runtime revision 不因方法调用本身增加
- **AND** 方法后来修改 value State 时按该 value Contract 决定是否失效

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

