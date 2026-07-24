## ADDED Requirements

### Requirement: 版本化 JSON 文档

系统 MUST 在 `@compose-ui/core` 提供 `schemaVersion: 1` 的 `ComposeDocument`、严格 JSON 值类型和
无 React/DOM 依赖的文档校验器。文档 MUST 使用稳定 `rootIds` 与规范化节点表，并且不得保存
`undefined`、函数、symbol、bigint、循环对象、React 元素或类实例。

#### Scenario: 校验合法多 Frame 文档

- **WHEN** 宿主校验一个包含多个 Frame、Group、Component 和 JSON props 的版本 1 文档
- **THEN** 校验结果返回该文档有效
- **AND** 文档可以通过 JSON 序列化后保持相同业务结构

#### Scenario: 拒绝非 JSON 属性

- **WHEN** Component props 包含函数、undefined、bigint、非有限数字或循环引用
- **THEN** 校验结果返回稳定 issue code、可定位 path 和可读消息
- **AND** 校验器不会把候选值强制转换成另一种数据

#### Scenario: 拒绝未知文档版本

- **WHEN** 候选文档的 `schemaVersion` 不是 1
- **THEN** 校验结果明确报告不支持的版本
- **AND** 候选文档不会被当成当前版本继续处理

### Requirement: 规范化节点拓扑

系统 MUST 将节点建模为 `frame`、`group` 或 `component` 判别联合。Frame MUST 且只能位于
`rootIds`；Group 与 Component MUST 由且仅由一个 Frame 子树可达；每个 child ID MUST 存在，
同一节点不得拥有多个父节点，拓扑不得形成环。

#### Scenario: 使用合法 Frame 子树

- **WHEN** Frame 的 childIds 引用 Group 与 Component，且每个后代只出现一次
- **THEN** 校验结果保留给定子节点顺序
- **AND** 宿主可以从 rootIds 确定性遍历完整文档

#### Scenario: 拒绝悬空或重复父节点

- **WHEN** childIds 引用不存在节点，或同一节点同时属于两个父节点
- **THEN** 校验结果分别报告悬空引用或重复父节点
- **AND** 无效拓扑不会产生部分可用的文档

#### Scenario: 拒绝根级普通节点或循环

- **WHEN** rootIds 包含 Group/Component，或任意 childIds 链回祖先
- **THEN** 校验结果报告根节点种类或循环路径错误

### Requirement: 节点变换与显示状态

每个节点 MUST 保存稳定 ID、名称、visible、locked 与相对父节点的 transform。无限空间 MUST
允许有限负坐标；width/height MUST 为有限正数；rotation MUST 为有限角度，且 Frame rotation
MUST 为零。

#### Scenario: 接受无限空间负坐标

- **WHEN** Frame 或后代节点使用有限负 x/y 与合法尺寸
- **THEN** 文档校验通过且坐标保持不变

#### Scenario: 拒绝非法变换

- **WHEN** transform 包含 NaN、Infinity、零或负尺寸，或者 Frame 使用非零 rotation
- **THEN** 校验结果定位到对应 transform 字段
- **AND** 不返回经过静默修正的文档

### Requirement: 可序列化组件节点

Component 节点 MUST 保存非空稳定 `componentType` 与 `JsonObject` props，不得在文档中保存
renderer、Inspector、默认值 factory 或运行时注册表引用。

#### Scenario: 保存未知组件类型

- **WHEN** 文档包含当前宿主尚未注册的非空 componentType
- **THEN** 文档结构校验仍然通过
- **AND** 组件类型的运行时可用性留给 renderer 层处理

#### Scenario: 拒绝空组件类型

- **WHEN** Component 的 componentType 为空字符串
- **THEN** 校验结果定位到该 Component 的 componentType
