# component-registry Specification

## Purpose
TBD - created by archiving change add-infinite-stage-composition. Update Purpose after archive.
## Requirements
### Requirement: 独立宿主组件注册表

系统 MUST 提供可独立安装的 `@compose-ui/component-registry` React 包。宿主 MUST 通过实例级
registry 按唯一非空 type 注册 `ComponentDefinition`；包 MUST 依赖 core 公共协议、把 React
作为 peer dependency，并且不得依赖 editor、stage、preview 或 property-panel。

#### Scenario: 创建有序注册表

- **WHEN** 宿主使用多个合法 definition 创建 registry
- **THEN** registry 可以按 type 读取 definition，并按注册顺序列出全部 definitions
- **AND** registry 创建后不会被外部数组修改

#### Scenario: 拒绝重复或非法 definition

- **WHEN** definitions 包含空 type、重复 type、非正默认尺寸或非 JSON 默认 props
- **THEN** registry 创建明确失败并定位到对应 definition
- **AND** 不产生部分注册表或模块级残留状态

#### Scenario: 隔离多个注册表实例

- **WHEN** 同一页面创建两个包含不同 definitions 的 registry
- **THEN** 每个实例只解析自身 type
- **AND** 注册或渲染状态不会跨实例泄漏

### Requirement: 可序列化组件默认值

每个 definition MUST 提供 label、默认尺寸和返回 `JsonObject` 的 props factory，并 MAY 提供
React icon。每次创建 MUST 得到独立 JSON props，不得把函数、Schema、React 元素或共享可变
引用写入 ComposeDocument。

#### Scenario: 创建独立组件种子

- **WHEN** 宿主连续两次从同一 definition 创建节点种子
- **THEN** 两份种子具有相同业务默认值但不共享可变 JSON 对象
- **AND** 默认尺寸保持合法且可由创建命令使用

#### Scenario: 默认值 factory 返回非法数据

- **WHEN** props factory 返回非 JSON 值或抛出异常
- **THEN** 创建请求返回可读错误
- **AND** 不派发 component.create 命令

### Requirement: Renderer 与 Inspector 上下文

definition MUST 提供 React renderer，并 MAY 提供 Inspector renderer。Renderer MUST 接收只读
节点、JSON props 和 `editor | preview` 模式；Inspector MUST 接收只读节点与统一 dispatch，
以便宿主组合 PropertyPanel 而无需 registry 包依赖 property-panel。

#### Scenario: 渲染编辑和预览内容

- **WHEN** Stage 与 Preview 使用同一 definition 渲染同一 Component
- **THEN** renderer 分别收到 editor 与 preview 模式以及相同 JSON props
- **AND** registry 本身不拥有组件状态或文档写入入口

#### Scenario: Inspector 派发属性命令

- **WHEN** Inspector renderer 中的宿主 PropertyPanel 产生有效值
- **THEN** Inspector 可以通过上下文 dispatch 发送结构化属性命令
- **AND** Inspector 不直接修改只读节点或 props

### Requirement: 未知和失败 Renderer 隔离

系统 MUST 为未知 componentType、renderer 异常和 Inspector 异常提供稳定错误描述，使单个宿主
组件失败不会卸载完整 Stage、Preview 或编辑器。

#### Scenario: 遇到未知组件类型

- **WHEN** 文档包含 registry 中不存在的 componentType
- **THEN** 消费方可以显示包含 type 的可访问占位
- **AND** 原始文档与未知 JSON props 保持不变

#### Scenario: Renderer 抛出异常

- **WHEN** 单个 renderer 或 Inspector renderer 抛出异常
- **THEN** 错误边界只替换对应组件或 Inspector 内容
- **AND** 其他组件和编辑命令仍可使用

### Requirement: 组件默认节点样式

ComponentDefinition MAY 提供返回 NodeStyle 的 factory。Registry MUST 在每次 createSeed 时返回
独立 style，并 MUST 拒绝 factory 异常或非法 style；未提供 factory 的现有 definition MUST
保持原行为。

ComponentDefinition MAY 另外提供非空 `defaultName`；seed MUST 带上该名称，省略时 MUST 回退
到 definition label，使 materials 可以分别覆盖 Palette label 与文档节点 name。

#### Scenario: 创建带独立 style 的组件种子

- **WHEN** definition 连续创建两个带默认 style 的 seed
- **THEN** 两个 seed 的业务值相同但不共享可变 style 或 shadow
- **AND** 原有 props 独立性保持不变

#### Scenario: 拒绝非法默认 style

- **WHEN** style factory 抛出异常或返回非法 style
- **THEN** createSeed 返回稳定错误且不产生部分 seed

### Requirement: 通用节点 Inspector 上下文

Registry 公共协议 MUST 提供只读 NodeInspectorProps，使独立包可以对 Frame、Group 或 Component
派发结构化命令；现有 ComponentInspectorProps MUST 保持兼容。

#### Scenario: 组合结构节点 Inspector

- **WHEN** 宿主把独立 Node Inspector 提供给 editor controller
- **THEN** Inspector 收到只读节点和统一 dispatch
- **AND** 不需要依赖 editor 内部类型或直接修改文档

### Requirement: Definition 资源创建协议

ComponentDefinition MAY 隐藏 Palette 项并声明资源 MIME 匹配和异步 seed factory。Registry MUST
按定义顺序选择首个匹配项，并把 unsupported 与 factory failure 作为结构化结果返回。

#### Scenario: 从图片资源创建 seed

- **WHEN** Registry 收到可解析的受支持图片
- **THEN** 首个匹配 definition 返回包含资源 props、名称与尺寸的独立 seed
- **AND** Palette hidden definition 仍可由 Stage 和 Preview 渲染

#### Scenario: 资源 factory 失败

- **WHEN** 没有 definition 匹配或 factory 抛错
- **THEN** Registry 返回稳定错误且不创建部分 seed

### Requirement: Renderer 资源解析上下文

RegistryComponent MUST 把可选 assetResolver 传给 definition renderer；省略 resolver 时原有
definition 行为 MUST 保持不变。

#### Scenario: 独立组件无 Resolver

- **WHEN** 非资源 definition 或旧宿主未提供 assetResolver
- **THEN** renderer 继续正常渲染
