# component-library Specification

## Purpose
TBD - created by archiving change add-linked-component-library. Update Purpose after archive.
## Requirements
### Requirement: Component Asset v1 判别协议

系统 MUST 以 `application/vnd.compose-ui.component+json` 和 `.component.json` 保存严格
`schemaVersion: 1` 的 Base/Variant 判别联合。Base MUST 保存稳定 ID、名称与单根 ComposeDocument v6；
根可以是任意 Entity，不再强制 first-class Group。Variant MUST 保存同 Provider 的直接父引用、
appliedLineage、规范操作和 resolvedSnapshot。Parser MUST 只验证当前文件；缺少 `kind` 的旧草案以及
含 `properties` 暴露属性的旧文件只能显式迁移。

#### Scenario: 解析 Base 与 Variant

- **WHEN** Parser 收到合法 Base 或 Variant 组件文件
- **THEN** 返回对应判别分支及稳定引用所需字段
- **AND** 不访问 Provider 或解析父链

#### Scenario: 接受非 Group 单根

- **WHEN** Base 文档的唯一根是 Container 或其他 Entity
- **THEN** Parser 接受该文档
- **AND** 多根文档仍被拒绝

#### Scenario: 拒绝旧草案并显式迁移

- **WHEN** `schemaVersion: 1` 文件缺少 `kind` 但满足历史草案结构
- **THEN** 普通解析返回结构化 legacy issue
- **AND** 显式迁移返回等价 `kind: "base"` 候选且不修改输入

#### Scenario: 暴露属性显式迁移

- **WHEN** Base 文件含 `properties` 暴露属性声明
- **THEN** 普通解析返回结构化 legacy issue
- **AND** 显式迁移删除该字段且不改变文档内容

### Requirement: 组件继承解析

Resolver MUST 按 Base、从根到叶 Variant 的顺序应用操作，并分别返回 `resolved`、`orphaned`、
`invalid` 或 `pending-update`。Variant MUST 与父源位于同 Provider 和兼容 scope，继承最多八层；
缺父源可使用保存快照，循环、超深和非法操作不得产生有效解析文档。

#### Scenario: 解析多层 Variant

- **WHEN** Variant 链具有可达父源、合法 lineage 和操作
- **THEN** 返回根到叶确定应用后的单根 v6 文档与继承属性定义

#### Scenario: 父源离线

- **WHEN** Variant 的父源不可读取但 saved resolvedSnapshot 合法
- **THEN** 返回 orphaned 并允许使用该快照渲染

#### Scenario: 拒绝循环与超深继承

- **WHEN** 父链形成循环、跨 Provider 或包含超过八个资源
- **THEN** 返回 invalid 和稳定 issue，且不返回半解析文档

### Requirement: 稳定 Variant 操作

Variant MUST 以稳定 Entity ID、Component Key、字符串字段路径、parentId 与 beforeEntityId 表达字段
set/remove、非基础 Component add/remove、Entity 子树 add/remove 和 reparent/reorder。数组 MUST 在包含它的
字段上原子替换；根、基础 Component 与最终 v6 合法性 MUST 受保护。

#### Scenario: 应用结构和字段覆盖

- **WHEN** 合法操作按稳定顺序应用于直接父快照
- **THEN** 得到通过 ComposeDocument v6 校验的确定文档
- **AND** 同一输入重复应用得到相同结果

#### Scenario: 拒绝非法目标

- **WHEN** 操作删除或移动根、删除基础 Component、引用缺失目标或使用数组位置路径
- **THEN** 整次解析失败且返回对应操作 ID 的 issue

### Requirement: 项目组件 Store

Component Store MUST 从 Asset Provider 列举、读取、创建、保存、解析和订阅组件资源，并正确处理
取消、缓存、迟到结果、名称冲突和 revision 冲突。新建 MUST 拒绝覆盖已有资源；普通保存 MUST 使用
已读取 revision，只有宿主显式请求时才允许强制覆盖。

#### Scenario: 列举并订阅项目组件

- **WHEN** Provider 同时含普通文件、Base 与 Variant 且目录 revision 改变
- **THEN** Store 只返回合法组件描述、按稳定 key 排序并使过期请求结果失效

#### Scenario: 保存 revision 冲突

- **WHEN** 文件 revision 在读取后发生变化
- **THEN** 普通保存拒绝且缓存不伪装为成功
- **AND** 显式强制保存可以使用 Provider 的强制写入语义

### Requirement: 混合组件目录

组件面板 MUST 聚合 Registry 中可见 Preset、主组件（Base）与变体（Variant），使用符合「主组件实心、
变体可区分」规则的图标，并将点击或拖拽转换为无 Stage 依赖的**实例创建意图**（引用对应资源）。
未配置 Store 时 MUST 保持现有 Registry Palette 能力。从目录创建变体 MUST 使用显式菜单或动作，
MUST NOT 与拖拽创建实例使用同一默认路径。

#### Scenario: 无 Store 保持兼容

- **WHEN** 宿主只提供 Registry
- **THEN** 面板继续列出和创建可见 Preset 且不显示项目资源错误

#### Scenario: 区分主组件与变体

- **WHEN** Store 返回 Base 与 Variant 描述
- **THEN** 两者显示不同图标、accessible name、稳定资源引用
- **AND** 变体可识别其父源

#### Scenario: 拖拽仅产生实例意图

- **WHEN** 用户拖拽主组件或变体目录项
- **THEN** 发出的创建意图为实例化该引用
- **AND** 不包含隐式 createVariant 资源写入

### Requirement: Apply、Revert 与显式更新

系统 MUST 允许当前 Variant 或实例对单项/全部覆盖执行 Apply/Revert。Apply MUST 只写直接父源并先保存
父源，再消费当前层覆盖；Revert MUST 只删除当前层操作。源保存后依赖实例 MUST 按覆盖是否失效决定同步
方式：全部兼容时自动刷新 lineage 与快照，存在失效覆盖时 MUST 进入 pending-update 并由用户确认，
冲突不得静默丢弃或产生半解析快照。

#### Scenario: Apply 到直接父源

- **WHEN** 用户将覆盖 Apply 到 Base 或直接父 Variant
- **THEN** 父源先保存，发起层随后消费覆盖并刷新 lineage 与快照

#### Scenario: Apply 部分成功

- **WHEN** 父源写入成功但发起层保存或场景事务失败
- **THEN** 系统不回滚父源，保留本地覆盖以维持视觉并返回 partial success

#### Scenario: Revert 当前层

- **WHEN** 用户 Revert 字段、移除、移动或新增子树操作
- **THEN** 只删除当前层对应操作并恢复继承结果
- **AND** 新增子树存在依赖操作时先展示依赖并请求确认

#### Scenario: 无冲突时自动同步

- **WHEN** 组件源保存成功且依赖实例的全部覆盖仍可应用
- **THEN** 实例以一次事务刷新 lineage 与 resolvedSnapshot，不要求用户确认
- **AND** 该事务可被 Undo 回退

#### Scenario: 更新存在冲突

- **WHEN** 最新父链使操作目标或锚点失效
- **THEN** 实例进入 pending-update 并保留旧快照
- **AND** 用户确认丢弃列出的冲突后一次提交新状态

### Requirement: 实例层结构覆盖

系统 MUST 让 `component-instance` 以与 Variant 同构的稳定操作表达全部覆盖，包括字段 set/remove、
非基础 Component add/remove、Entity 子树 add/remove 与 reparent/reorder；数组按包含它的完整字段原子
处理。实例覆盖 MUST 只有结构操作一个分区，不再区分属性覆盖。实例操作 MUST 与 Variant 操作共用同一
校验器与边界约束，解析后的文档 MUST 通过 v6 校验。

#### Scenario: 单一分区保存

- **WHEN** 实例存在任意内部编辑
- **THEN** instanceOverrides 只保存稳定结构操作
- **AND** 解析顺序为 Base → 从根到叶的 Variant → 实例结构操作

#### Scenario: 共用边界校验

- **WHEN** 实例操作试图删除组件根、删除基础 Component 或把实体 reparent 出实例子树
- **THEN** 操作以与 Variant 层一致的稳定 issue 被拒绝

#### Scenario: 旧属性分区显式迁移

- **WHEN** 读取含 `properties` 分区的既有实例覆盖
- **THEN** 显式纯迁移把每条属性覆盖转换为指向同一 target 的 set-field 操作，渲染输出不变
- **AND** Parser 不静默接受旧分区

### Requirement: Unity 对齐的主组件、变体与实例产品语义

系统 MUST 以与 Unity Prefab 体系同构的三层产品语义呈现组件能力：主组件（Base 资源）、变体
（Variant 资源，继承直接父源）、实例（页面上的 component-instance）。产品文案 MUST 使用「主组件」
「变体」「实例」；变体资源 MUST 能展示其直接父源的显示名（「基于 {父名}」）。拖入画布与复制实例
MUST NOT 隐式创建新的变体资源文件。

#### Scenario: 三层用语固定

- **WHEN** 用户在组件库查看 Base 与 Variant，并在页面选中 component-instance
- **THEN** 界面分别以主组件、变体、实例语义标识，且变体显示基于其父源

#### Scenario: 拖入不建变体

- **WHEN** 用户从组件库将主组件或变体拖入画布
- **THEN** 仅创建引用该资源的实例
- **AND** 组件库中不新增变体文件

### Requirement: 从实例创建变体对齐 Unity Prefab Variant

系统 MUST 提供显式「创建变体」动作。从页面实例创建时，新变体的父源 MUST 为实例当前引用的组件，
变体 overrides MUST 来自实例本层结构覆盖；创建成功后 MUST 默认将该实例的引用切换为新变体并清除
已固化到变体中的本层覆盖。创建变体 MUST NOT 作为复制实例或拖入画布的默认副作用。

#### Scenario: 实例另存为变体并改绑

- **WHEN** 用户对含本层覆盖的实例执行创建变体并确认名称
- **THEN** 库中新增 Variant 资源，其父引用为原实例引用，overrides 含原本层操作
- **AND** 该实例改为引用新变体且本层覆盖被清空

#### Scenario: 复制实例不创建变体

- **WHEN** 用户复制页面上的组件实例
- **THEN** 得到新的实例实体且 reference 与源实例相同
- **AND** 不创建新的变体资源

### Requirement: 主组件与变体的图标区分

组件库与资源列表中，主组件 MUST 使用实心组件符号图标，变体 MUST 使用可区分的变体图标（空心同形
或实心加侧向条纹，全产品一致）。图标差异 MUST NOT 仅依赖颜色。accessible name MUST 能区分主组件
与变体。

#### Scenario: 库列表可区分主组件与变体

- **WHEN** 组件库同时列出同一业务名的主组件与其变体
- **THEN** 两者图标形态不同且辅助技术名称可区分
- **AND** 变体展示基于父源的信息

### Requirement: 实例覆盖写回直接父源（含主组件）缺陷修复

系统 MUST 保证页面 component-instance 的本层结构覆盖可通过 Apply（单项或全部）写入其**直接
父源**资源：父源为 Base 时 MUST 更新并保存主组件文档；父源为 Variant 时 MUST 更新并保存该变体。
经实例根或实例内部编辑产生的、应对齐 Unity「Apply to Prefab」的改动 MUST 进入
`instanceOverrides.operations`，不得仅停留在无法 Apply 的瞬时状态。Apply 完成后 MUST 在同一
产品流程中更新发起实例的 `resolvedSnapshot` 与剩余 `instanceOverrides`；若资源已保存而场景
事务失败，MUST 向用户说明父源已更新且提供恢复/重试路径，不得静默丢弃。写回主组件成功后，
其他引用同一主组件且覆盖兼容的实例 MUST 能通过既有自动同步或显式检查更新获得新快照。

#### Scenario: 引用主组件的实例 Apply 写回 Base

- **WHEN** 页面实例直接引用主组件，且本层存在至少一条结构覆盖（例如根外观或尺寸）
- **AND** 用户对该覆盖执行 Apply 或 Apply 全部
- **THEN** 主组件资源文档包含该覆盖结果并完成保存
- **AND** 发起实例的本层覆盖不再包含已消费操作，resolvedSnapshot 与主组件解析结果一致

#### Scenario: 根属性编辑可被 Apply

- **WHEN** 用户在选中实例时通过实例根属性通路修改应对齐组件根的字段
- **THEN** 修改以结构操作形式进入 instanceOverrides
- **AND** Apply 全部时父源（主组件或变体）被更新，而非因 operations 为空而跳过写入

#### Scenario: 父源已写场景未更新时的可恢复失败

- **WHEN** Apply 已成功保存直接父源但更新发起实例的场景事务未提交
- **THEN** 用户可见明确失败或警告状态
- **AND** 可通过重试或检查更新使该实例快照与父源对齐，且父源不被错误回滚

#### Scenario: 写回主组件后其他实例可同步

- **WHEN** 实例 A 将覆盖 Apply 到主组件成功
- **AND** 实例 B 引用同一主组件且无冲突本层覆盖
- **THEN** 实例 B 经自动同步或用户检查更新后呈现主组件上的对应变更

