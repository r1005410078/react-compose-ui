## MODIFIED Requirements

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

Renderer Definition MUST 接收只读 Entity、Renderer props、editor/preview 模式和可选资源 resolver。
Component Definition MAY 提供对应 Component Inspector；Renderer Definition MAY 提供内容 Inspector。

#### Scenario: 聚合 Renderer 和 Component 区

- **WHEN** Inspector 解析一个已注册 Entity
- **THEN** 各 Component Inspector 按 Registry 顺序渲染
- **AND** Renderer 内容 Inspector 收到同一 Entity 和统一 dispatch

### Requirement: Capability 规划

Registry MUST 计算可添加、冲突、依赖和可移除状态。添加 MUST 自动补齐依赖且不得覆盖已有未知
Component；移除 MUST 阻止基础项、依赖方、缺失定义和含子项 Container，不得级联删除。

#### Scenario: 添加容器与几何限制

- **WHEN** 用户给 Renderer Entity 添加内建容器或几何限制
- **THEN** Registry 分别规划 Hierarchy+Clip 或 TransformConstraints 的原子 batch

#### Scenario: 阻止危险移除

- **WHEN** 能力仍被依赖、定义缺失、拥有基础 Component 或 Container 含有子项
- **THEN** 移除入口禁用并返回可读原因

### Requirement: 未知 Definition 降级

Registry 消费方 MUST 为未知 Component、Capability 和 Renderer 显示包含稳定 ID 的可访问占位，
并 MUST 保留原始 JSON。

#### Scenario: 缺失插件后打开文档

- **WHEN** 文档包含当前 Registry 未注册的合法 Component、Capability 或 Renderer
- **THEN** Stage/Preview/Inspector 只降级对应区域
- **AND** 其他 Entity 与编辑操作保持可用

## ADDED Requirements

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
