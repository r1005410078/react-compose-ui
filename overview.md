# ComposeUI 可视化应用架构设计

## 文档定位

本文描述 ComposeUI 的目标架构和领域边界，用于指导后续 OpenSpec 提案，不代表当前已经稳定
的公共 API。正式的文档 Schema、ECS 组件协议、System 调度、组件设计、绑定和持久化协议，
仍需分别经过规范评审后才能实现。

ComposeUI 的目标是：

> 将传统代码驱动的 UI 转变为可编辑、可组合、可运行、可版本化，并且可被 AI 理解的应用资产。

组件模型参考 ECS（Entity Component System），坚持组合优于继承：

```text
Entity 表示稳定身份
Component 表示可组合的数据与能力
System 表示处理 Component 的行为
Blueprint 表示可复用的 Entity 组合
Profile 表示 Feature Bundle 的命名组合
```

这里的概念不要求分别对应 npm 包，也不构成传统的继承式“分层组件框架”。

ComposeUI 借鉴 ECS 的职责分离和组合模型，但第一阶段不实现面向游戏循环优化的 Archetype、
Chunk 存储或并行调度器。Document 优先采用易序列化、易迁移、易产生事务差异的规范化 Map；
只有性能数据证明有必要时，Runtime 才建立额外索引或数据导向存储。

## 核心原则

```text
Document 声明应用
Entity 组合 Component
Registry 声明 Component 和 System 能力
Blueprint 复用 Entity 组合
Binding 连接数据与 UI
Runtime 执行 System
Render Projection 描述目标无关的视图
Renderer Adapter 产生目标平台 UI
Transactional Microkernel 原子修改 Document
Editor、AI 和 Extension 统一提交 Command
Observability Event 贯穿编辑、运行和渲染链路
```

架构必须避免：

- 一个节点只能对应一个庞大的 `componentType`；
- 通过 BaseComponent → Variant → SubVariant 建立类型继承链；
- 把特定渲染器 Props、编辑器状态和运行时状态混入同一对象；
- 把运行时函数、平台 UI 对象、DOM 对象或凭据写入文档。

## 总体架构

```text
                            Host Application
       Registry / Data / Action / Storage / Permission / Observability
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                           Authoring                               │
│                                                                   │
│ Scene Tree / Canvas / Entity Inspector / Component Designer      │
│                           │                                       │
│                           ▼                                       │
│                         Command                                   │
└───────────────────────────┼───────────────────────────────────────┘
                            ▼
              Transactional Editor Microkernel
              Resolve / Validate / Apply / Commit
                            │
                            ▼
                       Transaction
                            │
                            ▼
                   Application Document
          可序列化、可版本化、可迁移的唯一事实来源
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
         Entity World   Blueprint Assets   Bindings
              │             │              │
              └─────────────┼──────────────┘
                            ▼
                Migrate / Validate / Resolve
                            │
                            ▼
                     Runtime World
                            │
                            ▼
                       ECS Systems
                            │
                            ▼
                    Render Projection
                            │
                            ▼
                    Renderer Adapter
                            │
               ┌────────────┼────────────┐
               ▼            ▼            ▼
           React DOM     Canvas/WebGL   Other Target
```

Application Document 是 Editor 和 Preview 共享的公开协议。两者不共享 Dockview、目标渲染器
状态或其他内部对象，只通过公开的 ECS 文档、Registry 和 Runtime Adapter 产生一致结果。

## 1. Application Document（应用文档）

### 解决的问题

> 一个应用由哪些可以保存、迁移、发布和重建的声明组成？

Application Document 是可发布应用的唯一事实来源，负责保存：

- Schema 版本和应用身份；
- 页面或场景中的 Entity 与序列化 Component；
- Blueprint、Feature Bundle 和 Profile 引用；
- Binding Declaration；
- 资源引用及其他可移植元数据。

以下类型只用于说明边界，不是已确定的公共 API：

```ts
interface ApplicationDocument {
  schemaVersion: string
  applicationId: string
  scenes: SceneDocument[]
  blueprintReferences?: BlueprintReference[]
  resources?: ResourceReference[]
}

interface SceneDocument {
  id: string
  entities: Record<EntityId, EntityRecord>
}
```

Document 必须满足：

- 只包含可序列化的普通数据；
- Entity、Component、Binding 和资源使用稳定 ID 或稳定类型标识；
- 每个 Schema 版本具有明确的校验与迁移入口；
- 不保存 Query 结果、订阅连接和 System 临时缓存；
- 不保存选择、展开、面板尺寸和拖拽状态；
- 不保存令牌、密码或设备控制凭据。

## 2. Entity World（实体世界）

### 解决的问题

> 应用中有哪些具有稳定身份的对象，每个对象组合了哪些能力？

Entity 本身只提供身份，不通过类继承获得行为。一个 Entity 可以同时拥有多个 Component：

```ts
interface EntityRecord {
  id: EntityId
  name?: string
  components: Record<ComponentType, SerializedComponent>
}

interface SerializedComponent {
  version: string
  data: unknown
}
```

例如 PCS 状态卡的根 Entity 可以由以下 Component 组成：

```text
Entity: pcs-card-01
├── Hierarchy
├── Layout
├── Renderable
├── DeviceReference
├── StatusPresentation
├── Visibility
├── Interaction
└── Bindings
```

组合带来的能力是正交的：

- 删除 `Interaction` 后成为只读卡片；
- 增加 `AlarmPulse` 后获得告警动效；
- 替换 `Layout` 数据可以改变布局，不需要创建新的组件子类；
- 增加 `PermissionGuard` 后控制行为受权限约束；
- 同一个 `DeviceReference` 可以被卡片、表格或拓扑图的 System 使用。

Component 的粒度应以“是否由相同 System 消费、是否独立变化、是否可以独立复用”为依据。
不应把每个字段都拆成 Component，也不应把所有 Props 堆进一个无法组合的大对象。

## 3. Scene Graph（场景图投影）

### 解决的问题

> 哪些 Entity 形成可视层级，谁包含谁，按照什么顺序展示？

Scene Graph 不再是独立于 ECS 的第二份节点数据，而是对 Entity World 中 `Hierarchy` Component
的投影。

```ts
interface HierarchyComponent {
  parentId: EntityId | null
  order: string
}
```

例如：

```text
EMS 页面
├── Header
├── PCS 区域
│   ├── PCS 状态卡
│   └── 控制按钮
└── BMS 区域
    └── Pack 列表
```

Scene Graph 负责展示和操作：

- `Hierarchy` 关系；
- 同级顺序；
- Entity 名称和可见性摘要；
- Scene Tree 所需的选择和拖拽投影。

它不负责保存另一份组件实例、业务数据或目标平台渲染树。`@compose-ui/scene-tree` 继续作为受控组件，
只接收 Entity World 的投影结果并发出操作意图。

不是所有 Entity 都必须出现在 Scene Graph 中。Query、Action、数据源或其他非可视 Entity
可以存在于 World 中，但不具有 `Hierarchy` 或 `Renderable` Component。

## 4. Component Registry（组件注册）

### 解决的问题

> 每种 Component 保存什么数据，允许如何编辑，由哪些 System 消费？

ECS Component 必须以数据为中心。Registry 为每个 `ComponentType` 注册：

- 数据 Schema 和版本；
- 默认数据；
- 校验与迁移；
- 是否允许一个 Entity 持有该 Component；
- 依赖、互斥和适用范围；
- Inspector 编辑描述；
- 可选的组合或冲突处理规则。

下面的接口只表达方向：

```ts
interface ComponentDefinition<T> {
  type: string
  version: string
  validate(data: unknown): T
  createDefault(): T
  requires?: string[]
  conflicts?: string[]
}
```

Component Definition 本身不包含平台 UI 对象或宿主副作用。Inspector 控件和各目标平台的
View Adapter 可以使用同一个 `ComponentType` 注册额外适配器，但这些实现不能进入 core
文档协议。

### 建议的基础 Component

第一阶段只定义完成纵向流程所需的最小集合：

| Component | 职责 |
| --- | --- |
| `Hierarchy` | 父子关系与顺序 |
| `Renderable` | 声明目标无关的 View 类型 |
| `Layout` | 尺寸、位置和布局约束 |
| `Visibility` | 显示条件和编辑器可见性 |
| `Bindings` | Entity 字段与逻辑值的绑定声明 |
| `Interaction` | UI 事件到 Action 的映射 |

工业领域能力如 `DeviceReference`、`TelemetrySource`、`PermissionGuard` 应通过后续用例逐步加入，
不在基础 Schema 中一次性预设完整领域模型。

## 5. System Registry（系统注册）

### 解决的问题

> 哪些行为处理哪些 Component，按照什么阶段执行？

System 保存行为，Component 只保存数据。System 通过查询选择 Entity：

```ts
interface SystemDefinition {
  id: string
  phase: RuntimePhase
  query: {
    all?: ComponentType[]
    any?: ComponentType[]
    none?: ComponentType[]
  }
  reads: ComponentType[]
  writes: ComponentType[]
}
```

System 实现由 Runtime 或宿主 Registry 提供，不作为函数写入 Application Document。典型
System 包括：

- Blueprint Resolve System；
- Query/Subscription System；
- Computed System；
- Binding System；
- Visibility System；
- Interaction/Action System；
- Render Projection System；
- Diagnostics System。

Runtime 根据 `phase`、`reads` 和 `writes` 建立确定的执行计划。依赖冲突和循环必须在运行前
被诊断，不能依赖注册顺序碰巧正确。

System 不应绕过宿主边界直接访问任意网络、文件或设备接口。有副作用的 System 必须通过
Host Adapter 执行。

## 6. Component Designer（组件设计器）

### 解决的问题

> 用户如何把 Entity、Component 和子 Blueprint 组合成可复用组件？

Component Registry 提供原子能力；Component Designer 用这些能力创建可复用的
`Blueprint Asset`。这就是组件设计层。

```text
Primitive Components
Hierarchy / Layout / Renderable / Interaction / ...
                         │
                         ▼
                 Component Designer
                         │
                         ▼
                   Blueprint Asset
            Entity Graph + Component Sets
             + Parameters + Events + Slots
```

Blueprint 可以包含：

- 使用局部稳定 ID 的 Entity Graph；
- 每个 Entity 上的 Component 集合；
- 对外公开的 Parameter；
- 对外发布的 Event；
- 允许调用方插入内容的 Slot；
- 内部 Binding；
- 嵌套 Blueprint 引用；
- 可选 Feature 和约束。

以下类型仅用于说明：

```ts
interface BlueprintAsset {
  id: string
  version: string
  entities: Record<LocalEntityId, EntityRecord>
  parameters: ParameterDefinition[]
  events: EventDefinition[]
  slots: SlotDefinition[]
  features?: FeatureSlotDefinition[]
}
```

Component Designer 应提供：

- 隔离编辑 Blueprint 内部 Entity World；
- 为 Entity 添加、移除和配置 Component；
- 将内部 Component 字段暴露为 Parameter；
- 声明 Event、Slot 和内部 Binding；
- 嵌套已有 Blueprint；
- 预览不同 Feature/Profile 组合；
- 检测 Blueprint 循环引用；
- 通过 Command/Transaction 保存所有修改。

## 7. Blueprint、Feature Bundle 与 Profile（组合式复用）

### 解决的问题

> 如何实现类似 Unity Prefab Variant 的复用体验，同时避免继承链？

ComposeUI 不建立：

```text
BaseComponent
    ↓ extends
AlarmVariant
    ↓ extends
CompactAlarmVariant
```

而使用显式组合：

```text
DeviceCard Blueprint
        +
Alarm Feature Bundle
        +
Compact Feature Bundle
        +
Controllable Feature Bundle
        +
Instance Parameters
        =
Resolved Entity Graph
```

### Feature Bundle

Feature Bundle 是可以附加到 Blueprint 或实例的能力集合，可以：

- 为目标 Entity 增加 Component；
- 为已有 Component 提供一组显式配置；
- 向指定 Slot 插入子 Blueprint；
- 声明 `requires` 和 `conflicts`；
- 暴露额外 Parameter 或 Event。

例如：

```text
Alarm Feature
├── StatusPresentation { tone: "danger" }
├── AlarmPulse { duration: 800 }
└── Slot overlay += AlarmBadge Blueprint

Compact Feature
├── Layout { density: "compact" }
└── Slot details = hidden

Controllable Feature
├── Interaction
├── PermissionGuard
└── Slot actions += ControlButtons Blueprint
```

### Profile

Profile 是一组 Feature Bundle 和参数的命名配方，不允许继承另一个 Profile：

```text
Normal Profile  = [BaseAppearance]
Alarm Profile   = [BaseAppearance, AlarmFeature]
Offline Profile = [BaseAppearance, OfflineFeature, ReadOnlyFeature]
```

这样 `Alarm + Compact + Controllable` 可以自由组合，避免为每个排列创建新的 Variant 子类。

### 组合与冲突规则

组合优于继承不代表使用隐式的“后者覆盖前者”。Resolver 必须采用明确规则：

1. 不同 ComponentType 可以直接共存；
2. 同一 Entity 上的单实例 Component 出现多份贡献时，默认报告冲突；
3. 只有 Component Definition 明确提供 merge 规则时才能合并；
4. 替换或移除必须显式指定目标 Component 或 Slot；
5. `requires`、`conflicts` 和 Blueprint 循环在解析阶段校验；
6. Profile 中 Bundle 的集合是显式配方，不形成父子继承链；
7. 实例覆盖只保存调用方明确修改的字段，并能逐项恢复默认值。

最终解析公式为：

```text
Blueprint Entity Graph
      + selected Feature Bundles
      + Profile parameters
      + Instance parameters and slots
      + explicit Instance overrides
      = Resolved Entity Graph
```

Resolved Entity Graph 是编译产物，默认不持久化为第二份事实来源。

## 8. Logic Components 与 Runtime（逻辑与执行）

### 解决的问题

> 页面数据和行为如何以 ECS 方式声明并执行？

逻辑对象也可以表示为 Entity 和序列化 Component，不要求它们具有可视层级：

```text
Entity: ems-query
├── Query
├── DataSourceReference
└── PollingPolicy

Entity: pcs-alarm
├── Computed
└── DependencyReferences

Entity: start-pcs
├── Action
├── PermissionGuard
└── AuditPolicy
```

第一阶段应采用可校验表达式和已注册能力，不把任意 JavaScript 闭包直接写入 Document。
如果未来支持用户脚本，必须单独设计沙箱、资源限制、错误隔离和能力授权。

Runtime 负责创建 `Runtime World`：

- 保留 Document World 的 Entity 身份；
- 解析 Blueprint 和 Feature 组合；
- 创建 Query 结果、loading、error 等 runtime-only Component；
- 调度 Computed、Binding 和 Action System；
- 管理订阅生命周期和诊断；
- 通过 Host Adapter 执行外部副作用。

Runtime System 可以修改 Runtime World，但不能悄悄反向修改 Document。需要持久化的变化必须
转换为显式 Editor Command 或业务持久化操作。

## 9. Binding Declaration 与 Binding System（绑定）

### 解决的问题

> 一个 Entity 的 Component 字段如何驱动另一个 Entity？

Binding 使用稳定字段引用：

```text
ems-query.QueryResult.value.power
        ↓
pcs-card.StatusPresentation.power

start-button.Interaction.onClick
        ↓
start-pcs.Action.trigger
```

Document 保存 Binding Declaration。运行前，Binding System 将声明编译为依赖图，并负责：

- 验证 Entity、Component 和字段引用；
- 检查数据类型；
- 检测循环依赖；
- 生成确定的执行顺序；
- 批处理同一事务中的更新；
- 传播或隔离 loading、error 等状态；
- 释放已删除 Entity 或订阅的依赖。

Binding Graph 是派生结果，不与 Binding Declaration 双重持久化。

## 10. Render Projection 与 Renderer Adapter（渲染适配）

### 解决的问题

> 如何把 Runtime World 投影到不同 UI 技术，同时不污染核心文档？

具有 `Renderable` Component 的 Entity 会进入目标无关的 Render Projection：

```ts
interface RenderableComponent {
  view: string
}
```

`view` 是稳定的语义标识，例如 `compose-ui/device-card`，不是 React 组件名、DOM 标签或
Canvas 绘制函数。Render Projection 保存 Entity 身份、View 标识、层级和所需数据引用，是
可以重新生成的运行时结果，不进入 Application Document。

不同 Renderer Adapter 使用相同 View 标识注册目标实现：

```text
view: compose-ui/device-card
├── react-dom adapter → React Component
├── canvas2d adapter  → Canvas drawing implementation
├── webgl adapter     → WebGL implementation
└── server adapter    → Server-rendered output
```

Renderer Adapter 可以读取投影中允许的 Component 数据，但不能拥有 Document，也不能直接
修改其他 Entity。交互事件必须转换成 Runtime Action，业务状态更新继续由 System 处理。

目标适配层必须声明自身能力，例如是否支持 DOM 交互、自由布局、动画、无障碍语义或服务端
输出。发布前的兼容性检查根据目标能力诊断不支持的 View 或 Feature；不能在 core 中默认所有
目标都具有浏览器 DOM。

建议的运行管线：

```text
Load Document
      ↓
Migrate and Validate
      ↓
Resolve Blueprint / Feature / Profile
      ↓
Create Runtime World
      ↓
Compile Systems and Bindings
      ↓
Run Runtime Systems
      ↓
Build Render Projection
      ↓
Selected Renderer Adapter
```

当前仓库的首个 Renderer Adapter 可以是 React DOM，但这只是集成选择，不是核心架构限制。
Editor Canvas 与独立 Preview 必须消费同一套 Runtime 和 Render Projection 协议。未知
Component、View、Renderer Adapter 或 System 必须产生可定位诊断，并尽可能隔离到相关
Entity。

## 11. Transactional Editor Microkernel（事务型编辑器微内核）

### 解决的问题

> Editor UI、AI、快捷键和 Extension 如何通过同一条安全、可审计的路径修改 Document？

事务型微内核位于所有创作入口和 Application Document 之间，是 Document 的唯一修改入口：

```text
Scene Tree ─┐
Inspector ──┤
Canvas ─────┤
AI Agent ───┼──▶ Command ──▶ Transactional Microkernel
Shortcut ───┤                         │
Extension ──┘                         ▼
                                   Transaction
                                       │
                                       ▼
                              New Document Snapshot
```

微内核负责不可绕过的机制：

- 保存当前 Editor State Snapshot 和 Revision；
- 解析 Command 并生成确定的 Operation；
- 校验、规范化并原子提交 Transaction；
- 管理 Operation、Command 和 Extension Registry；
- 保证提交顺序和状态转换的确定性；
- 发布带 Transaction ID 和 Correlation ID 的结构化提交事件与诊断；
- 为 History、持久化和协作扩展提供事务流。

微内核不负责：

- Scene Tree、Inspector、Canvas 和 Dockview；
- 具体 Component、Blueprint 和领域业务；
- Runtime ECS System 和 Renderer Adapter；
- 文档存储、协作服务和设备控制；
- 任何目标平台 UI。

### Command、Operation 与 Transaction

三个概念必须分离：

| 概念 | 语义 | 是否依赖当前状态 | 是否用于重放 |
| --- | --- | --- | --- |
| Command | 用户或 AI 的编辑意图 | 是 | 否 |
| Operation | 确定的最小领域变化 | 尽量否 | 是 |
| Transaction | 原子提交的一组 Operation | 通过 `baseRevision` 校验 | 是 |

Command 例如“把选中的 Entity 移入 PCS 区域”。它可以因当前选择、权限或文档状态不同而生成
不同 Operation，也可以被拒绝。

Operation 描述已经解析的领域变化。ECS 的基础 Operation 可以包括：

```text
CreateEntity
DeleteEntity
AddComponent
RemoveComponent
SetComponentField
ReparentEntity
ReorderEntity
CreateBinding
RemoveBinding
InstantiateBlueprint
SetBlueprintParameter
```

每种 Operation 必须具有：

- 可序列化的 Payload；
- 明确的前置条件；
- 确定性的 `apply` 语义；
- Schema 和领域不变量校验；
- 在支持 undo 时可计算的 inverse；
- 在未来支持协作时可定义的映射或冲突语义。

随机 ID、当前时间和外部查询结果必须在 Command 解析阶段确定并写入 Operation，不能在
`apply` 过程中隐式读取环境。

以下结构只用于说明边界：

```ts
interface EditorTransaction {
  id: string
  baseDocumentRevision: number
  operations: SerializedOperation[]
  sessionChanges?: EditorSessionChange[]
  metadata: {
    origin: string
    addToHistory: boolean
    persistDocument: boolean
  }
}
```

Transaction 中任一 Operation 无效时，整个 Document Transaction 都不得提交。选择、焦点等
Session Change 可以与文档变化一起映射到新状态，但不进入发布文档，也不单独制造业务历史。

### 事务管线

```text
1. Resolve Command
2. Check Preconditions and Capability
3. Expand to Operations
4. Run Schema and Domain Validators
5. Normalize Operations
6. Apply to Draft Snapshot
7. Validate Result Invariants
8. Compute Inverse and Change Summary
9. Atomically Commit New Revision
10. Notify Projections and Extensions
11. Run After-Commit Effects
```

第 1～9 步必须尽可能保持同步、确定和可重放。校验器及规范化器不能执行网络请求、修改外部
对象或依赖目标渲染器状态。

保存、遥测、远端协作和其他副作用只能订阅已提交事务并在 After-Commit 阶段执行。异步命令
不得长期占用一个开放事务：它应先取得外部结果再构造 Transaction，或者先提交显式 pending
状态并在完成后提交新的补偿/完成事务。

日志 Sink 不得阻塞或改变事务提交结果。日志时间戳、采样结果和远端响应属于提交后的观察数据，
不能参与 Operation Apply 或 Document Revision 计算。

运行时 `Action` 与编辑器 `Command` 必须分开。用户在运行页面中执行设备控制属于 Runtime
Action，不得被包装成修改 Application Document 的 Editor Transaction。

### Extension 模型

编辑能力通过 Extension 组合，不向微内核硬编码全部领域：

```ts
interface EditorExtension {
  id: string
  dependencies?: string[]
  commands?: CommandHandlerRegistration[]
  operations?: OperationRegistration[]
  validators?: TransactionValidator[]
  normalizers?: TransactionNormalizer[]
  projections?: ProjectionRegistration[]
  afterCommit?: AfterCommitEffect[]
}
```

典型 Extension：

```text
entity-extension
├── CreateEntity / DeleteEntity
└── Entity ID 和引用校验

hierarchy-extension
├── ReparentEntity / ReorderEntity
├── 禁止父子循环
└── Scene Tree Projection

blueprint-extension
├── InstantiateBlueprint
├── SetBlueprintParameter
└── Blueprint 引用与组合校验

binding-extension
├── CreateBinding / RemoveBinding
└── 字段类型与循环依赖校验
```

Extension 必须显式声明依赖。Command Handler 可以扩展为 Operation，但不得直接修改 State；
Validator 不得产生变化；Normalizer 只能在受控阶段追加或替换 Operation。微内核必须检测循环
依赖，并避免把插件注册顺序变成不可见的业务优先级。

正式 History 是消费已提交 Transaction 和 inverse 的 Extension；Persistence、Collaboration
和 Audit 也是事务流消费者。它们不应成为所有领域代码都必须依赖的内核模块。当前
`@compose-ui/history` 仅提供会话级快照时间线与通用导航面板，用于在事务协议稳定前验证交互；
未来实现可以继续满足同一个 `HistoryNavigationController`，无需替换面板协议。

### Editor Kernel State

微内核可以维护统一 Snapshot，但必须保留状态作用域：

```ts
interface EditorKernelState {
  document: ApplicationDocument
  session: EditorSessionState
  extensions: Record<string, unknown>
  kernelRevision: number
  documentRevision: number
}
```

- `documentRevision` 只在发布文档变化时递增，用于保存和协作并发检查；
- `kernelRevision` 可以覆盖选择、诊断和 Extension State 变化；
- Extension State 属于 Editor State，不自动进入 Application Document；
- Runtime World 不由 Editor Kernel 持有，只根据提交后的 Document Snapshot 重建或增量同步。

## 12. Observability 与 Event Journal（日志与可观测性）

### 解决的问题

> 如何定位编辑、运行、绑定、渲染和宿主调用问题，同时满足事务追踪与工业操作审计？

日志系统是横切能力，不拥有 Document，也不能成为业务状态的第二份事实来源：

```text
Editor UI ──────────────┐
Transactional Kernel ──┤
Runtime Systems ────────┼──▶ Observability Event Hub
Binding Compiler ───────┤              │
Renderer Adapter ───────┤     Redact / Enrich / Filter
Host Adapter ───────────┘              │
                         ┌──────────────┼──────────────┐
                         ▼              ▼              ▼
                    Editor Buffer   Remote Sink    Audit Sink
```

所有子系统只依赖结构化事件协议或注入的 Event Emitter，不直接依赖 `console`、远端日志 SDK、
文件系统或某个厂商服务。

### 事件模型

以下结构只用于说明边界：

```ts
interface ObservabilityEvent<TPayload = unknown> {
  id: string
  timestamp: number
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  kind: 'transaction' | 'diagnostic' | 'runtime' | 'audit'
  category: string
  code: string
  message?: string
  correlationId?: string
  transactionId?: string
  context?: {
    applicationId?: string
    sceneId?: string
    entityId?: string
    componentType?: string
    systemId?: string
    rendererTarget?: string
  }
  payload?: TPayload
}
```

要求：

- `category` 和 `code` 是稳定、可检索的机器标识；
- `message` 用于展示，不作为程序判断条件；
- Error 必须规范化为可序列化数据，不能假设原始异常可以跨边界传输；
- `correlationId` 连接一次用户意图、Command、Transaction、Runtime 同步和渲染更新；
- `transactionId` 精确关联一次已提交或被拒绝的事务；
- 时间戳由 Event Hub 或 Host Clock 注入，不参与事务确定性计算。

### 四类事件流

| 事件流 | 内容 | 典型生命周期 | 主要消费者 |
| --- | --- | --- | --- |
| Transaction Journal | 已提交/拒绝事务的结构化摘要 | 编辑会话或持久化策略 | Transaction Log、调试、审计关联 |
| Diagnostics | 当前有效的错误、警告和修复建议 | 可产生、更新和解除 | Problems 面板、Inspector |
| Runtime Log | System、Binding、Renderer、Adapter 运行事件 | 有界缓冲或远端留存 | 开发者、实施工程师 |
| Audit Event | 用户、权限、控制命令及结果 | 按宿主合规策略持久化 | 安全审计系统 |

四者不能互相替代：

- History 保存 inverse 以实现 undo，不等于 Transaction Journal；
- Transaction Journal 记录编辑事实，不等于当前 Diagnostics；
- Runtime Log 可以采样或丢弃低级别事件，不适合作为安全审计；
- Audit Event 必须包含 Actor、Action、Target、Decision 和 Outcome，由宿主控制留存策略。

### 事件管线与 Sink

```text
Emit Structured Event
        ↓
Validate Event Schema
        ↓
Redact Sensitive Fields
        ↓
Enrich Context and Correlation
        ↓
Filter / Sample / Aggregate
        ↓
Route to One or More Sinks
```

建议支持的 Sink：

- Editor 内存 Ring Buffer；
- 开发环境 Console Sink；
- 宿主注入的 Remote Log Sink；
- Metrics/Trace Bridge；
- 独立的安全 Audit Sink。

普通 Sink 必须异步消费，不能阻塞 Transaction、Runtime System 或渲染循环。Event Hub 应使用
有界队列并提供背压策略：允许采样 `trace/debug`，但必须用计数事件报告丢弃量；`error/fatal`
不得被静默丢弃。Audit Sink 的失败是否阻止设备控制由宿主安全策略决定，不能由通用 Logger
擅自决定。

### 隐私与安全

默认事件只记录定位所需的元数据，不记录完整 Document、Operation Payload、Query 结果或
设备遥测。日志协议必须支持字段级脱敏和允许列表，并禁止记录：

- Token、Cookie、密码和请求头；
- 数据源连接凭据；
- 未经声明允许的业务数据；
- 完整设备控制 Payload；
- 任意序列化整个 Editor/Runtime State 的调试快捷方式。

Transaction Journal 可以保存经过 Schema 审查的 Operation 摘要或哈希；真正用于 undo、保存
或协作的 Transaction 数据由对应子系统管理，不通过普通日志反向恢复 Document。

### 诊断与性能观测

Diagnostics 使用稳定 Identity，例如 `source + code + entityId + componentType`，从而可以在问题
修复后解除，而不是不断追加重复日志。Binding 类型错误、未知 View、Blueprint 循环和无效
Component 应同时产生结构化 Diagnostic 与关联日志事件。

性能观测使用 Span/Metric 表达持续时间和计数，例如：

- Command 到 Transaction Commit 的耗时；
- Blueprint Resolve 和 Binding Compile 的耗时；
- 单个 System 阶段耗时；
- Render Projection 构建和 Renderer Adapter 更新时间；
- Event Queue 深度与丢弃数量。

Trace、Metric 与 Log 可以共享 Correlation Context，但不要把高频性能采样全部转换成长文本日志。

### Editor 中的日志界面

Editor 应区分不同面板语义：

- **Transaction Log**：展示事务来源、操作摘要、结果和 Revision；
- **Problems**：展示当前有效、可定位、可解除的 Diagnostics；
- **Runtime Log**：按 level、category、Entity、System 和 Correlation ID 过滤；
- **Audit View**：只在宿主授权时展示安全审计查询结果。

点击事件时可以定位相关 Entity、Component、Binding 或 Transaction，但定位行为只更新
Editor Session State，不修改 Application Document。

## 13. Editor（可视化创作环境）

### 解决的问题

> 用户如何安全、一致地编辑 Entity、Component 和 Blueprint？

```text
User Intent
    ↓
Editor Command
    ↓
Transactional Microkernel
    ↓
Document Transaction
    ↓
History + Transaction Log
    ↓
Updated Document World
```

Editor 负责：

- Scene Tree 展示 `Hierarchy` 投影；
- Canvas 通过所选 Renderer Adapter 展示 Render Projection；
- Entity Inspector 添加、删除和配置 Component；
- Component Designer 编辑 Blueprint 和 Feature Bundle；
- Binding Editor 连接 Component 字段；
- Profile Composer 选择和预览 Feature 组合；
- 将所有编辑意图提交给微内核；
- 分别展示 History、Transaction Log、Problems 和 Runtime Log。

Dockview 只负责当前工作区布局，属于 `@compose-ui/editor` 内部实现。Editor 不得把 Dockview
布局、选择状态或 Inspector 临时表单状态写入 Application Document，也不得绕过微内核直接
修改 Document World。

## 三种状态的边界

| 状态 | 示例 | 生命周期 | 是否进入发布文档 |
| --- | --- | --- | --- |
| Document State | Entity、序列化 Component、Blueprint、Binding | 保存、加载、迁移 | 是 |
| Runtime State | QueryResult、loading、error、订阅、System 缓存 | 每次运行实例 | 否 |
| Editor State | 选择、展开、焦点、面板尺寸、拖拽反馈 | 每次编辑器实例 | 否 |

边界规则：

- Editor 通过微内核的 Command/Transaction 修改 Document World；
- Extension State 属于 Editor State，不自动进入发布文档；
- Runtime World 根据 Document 重建，不反向污染 Document；
- 日志和诊断不作为 Document 或 Runtime State 的恢复来源；
- 需要保存为初始值的状态必须通过显式 Command 写回；
- 用户工作区偏好使用独立协议，不进入应用文档。

## 宿主能力与安全边界

宿主应用负责提供：

- Component、System、View 和 Renderer Adapter Registry；
- Editor Extension 和宿主能力授权；
- Query、订阅和 Action Adapter；
- 文档与 Blueprint 的保存、加载和发布；
- 用户身份、权限与审计；
- 密钥、令牌和环境配置；
- Event Sink、脱敏、采样、留存和安全审计策略；
- 日志、指标、Trace 和错误上报。

Application Document 只能引用宿主公布的能力 ID 和非敏感参数。Runtime 不允许文档绕过
Host Adapter 直接访问任意网络、文件系统或设备控制接口。

## 包边界

现阶段保留六个主要包，不按 ECS 概念机械拆包。

### `@compose-ui/core`

- React 和 DOM 无关；
- 承载 Entity、Component、Blueprint、Binding、Command、Operation、Transaction、校验和
  迁移协议；
- 提供事务微内核、Extension Registry 和纯状态转换；
- 定义结构化 Event、Diagnostic、Correlation Context 和 Sink Port；
- 提供 Scene Graph 投影、组合解析和其他纯算法；
- 不包含具体日志后端、目标平台 Renderer、Inspector 控件和 Dockview 类型。

### `@compose-ui/scene-tree`

- 独立受控 React 树组件；
- 接受 `Hierarchy` Component 的投影结果；
- 只发出选择变化和操作意图；
- 不依赖 `core` 或 `editor`，不拥有 Document World。

### `@compose-ui/property-panel`

- 独立的同步 Valibot Schema 驱动受控 React 组件；
- 不依赖 `core`、`editor`、`scene-tree` 或特定业务渲染器；
- 通过公共 Schema、值和变化事件与宿主组合，不拥有 Document World。

### `@compose-ui/history`

- 独立的 React 会话快照时间线、快捷键和受控历史面板；
- 不依赖 `core`、`editor`、`scene-tree` 或 `property-panel`；
- 当前只保存实例内不可变快照，不承担持久化、协作或审计；
- 面板只依赖导航控制器，未来可由 Transaction/inverse History Extension 复用。

### `@compose-ui/preview`

- 当前仓库中的独立 React DOM 预览入口；
- 通过公开协议消费 Document、Registry 和 Host Adapter；
- 不依赖 `editor`；
- 作为首个 Renderer Adapter 的集成包，不限制 core/runtime 支持其他渲染目标；
- 与 Editor Canvas 共享 ECS 解析和 Render Projection 语义；
- 通过注入的 Event Emitter 发布运行和渲染事件，不绑定日志后端。

### `@compose-ui/editor`

- 可嵌入 React 编辑器入口；
- 可以依赖 `core`、`scene-tree` 和 `history`；
- 提供 Entity Inspector、Component Designer 和组合编辑界面；
- 组装微内核 Extension，但不把编辑逻辑分散到 UI 事件处理器；
- 提供有界内存日志缓冲以及 Transaction、Problems、Runtime Log 面板；
- Dockview、面板对象和工作区状态保持内部实现。

当 ECS Runtime 已形成稳定边界，并确实需要被 Editor、Preview 或非 React 环境独立复用时，
再考虑提取 `@compose-ui/runtime`。当第二个真实渲染目标出现时，再根据共同协议评估独立的
`@compose-ui/renderer-*` 包，不提前为假设目标拆包。

## EMS 工业场景示例

```text
Entity: pcs-card
├── Hierarchy
├── Layout
├── Renderable { view: "compose-ui/device-card" }
├── DeviceReference { deviceId: "PCS01" }
├── StatusPresentation
├── Visibility
└── Bindings

Selected Features
├── AlarmFeature
├── CompactFeature
└── ControllableFeature
```

运行过程：

```text
Telemetry System
        ↓
QueryResult Component
        ↓
Computed System
        ↓
Binding System
        ↓
StatusPresentation Component
        ↓
Render Projection
        ↓
Selected Renderer Adapter
```

控制过程：

```text
Interaction Component
        ↓
Action System
        ↓
PermissionGuard + AuditPolicy
        ↓
Host Device Command Adapter
```

## 演进顺序

正式协议建议按一条可运行纵向流程逐步确定：

1. 定义最小 Document World、Entity、Component 和 Schema 版本；
2. 定义最小事务微内核以及 Entity/Component 基础 Operation；
3. 定义结构化 Event、Correlation、内存 Sink、Transaction Journal 和 Diagnostics；
4. 定义 `Hierarchy`、`Renderable`、Component Registry 与目标无关的 Render Projection；
5. 跑通“Editor Command → Transaction → Document → Preview”的完整流程；
6. 增加 Entity Inspector、History Extension、日志面板和保存加载；
7. 定义最小 Blueprint、Parameter 和 Slot，跑通可视化组件设计；
8. 增加 Feature Bundle、Profile 和显式组合冲突规则；
9. 增加 Binding、Query、Computed 和 Action System；
10. 根据真实用例扩展工业领域 Component、Host Adapter 和 Audit Sink。

每一步涉及新能力、公共 API 或 Schema 时，都必须先通过对应 OpenSpec 提案，并先用一个完整
的运行场景验证协议，再扩展抽象和组件种类。

## 架构不变量

后续设计和实现必须保持：

1. Application Document 是可保存应用的唯一事实来源；
2. Entity 只表示身份，能力来自多个 Component 的组合；
3. Component 保存可序列化数据，System 保存行为；
4. Blueprint、Feature 和 Profile 不形成继承链；
5. 相同 Component 的合并和冲突规则必须显式定义；
6. Scene Graph 是 `Hierarchy` 的投影，不维护第二份节点模型；
7. Document State、Runtime State 和 Editor State 严格分离；
8. Binding Graph 和 Resolved Entity Graph 都是可重建的编译结果；
9. 所有 Document 修改都必须经过事务微内核原子提交；
10. UI、AI 和 Extension 使用相同 Command/Transaction 入口；
11. Operation Apply 保持确定性，副作用只能在提交后执行；
12. 日志、Journal 和 Diagnostic 都不作为 Document 的第二份事实来源；
13. core/runtime 只发布结构化事件，不绑定 Console 或远端日志实现；
14. 敏感数据默认不进入日志，脱敏和审计策略由宿主控制；
15. core 不依赖 React、DOM、Dockview 或具体宿主服务；
16. Runtime 和 Render Projection 不依赖任何具体 UI 技术；
17. Preview 不依赖 Editor，二者只共享公开协议和渲染语义；
18. Scene Tree 保持独立受控，不拥有 Document World；
19. 凭据、权限和工业控制能力由宿主掌握，不进入 Document；
20. 新抽象必须由已验证的纵向用例驱动。
