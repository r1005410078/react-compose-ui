# component-library Specification

## Purpose
TBD - created by archiving change add-linked-component-library. Update Purpose after archive.
## Requirements
### Requirement: Component Asset v1 判别协议

系统 MUST 以 `application/vnd.compose-ui.component+json` 和 `.component.json` 保存严格
`schemaVersion: 1` 的 Base/Variant 判别联合。Base MUST 保存稳定 ID、名称、以 first-class Group 为
唯一根的 ComposeDocument v6 与暴露属性；Variant MUST 保存同 Provider 的直接父引用、appliedLineage、
规范操作和 resolvedSnapshot。Parser MUST 只验证当前文件；缺少 `kind` 的旧草案只能显式迁移为 Base。

#### Scenario: 解析 Base 与 Variant

- **WHEN** Parser 收到合法 Base 或 Variant 组件文件
- **THEN** 返回对应判别分支及稳定引用所需字段
- **AND** 不访问 Provider 或解析父链

#### Scenario: 拒绝旧草案并显式迁移

- **WHEN** `schemaVersion: 1` 文件缺少 `kind` 但满足历史草案结构
- **THEN** 普通解析返回结构化 legacy issue
- **AND** 显式迁移返回等价 `kind: "base"` 候选且不修改输入

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

组件面板 MUST 聚合 Registry 中可见 Preset、Base 与 Variant，使用不同且非纯颜色的图标，并将点击或
拖拽转换为无 Stage 依赖的创建意图。未配置 Store 时 MUST 保持现有 Registry Palette 能力。

#### Scenario: 无 Store 保持兼容

- **WHEN** 宿主只提供 Registry
- **THEN** 面板继续列出和创建可见 Preset且不显示项目资源错误

#### Scenario: 区分 Base 与 Variant

- **WHEN** Store 返回 Base 与 Variant 描述
- **THEN** 两者显示不同图标、accessible name 和稳定资源引用

### Requirement: Apply、Revert 与显式更新

系统 MUST 允许当前 Variant 或实例对单项/全部覆盖执行 Apply/Revert，覆盖同时包含属性覆盖与实例层结构
操作。Apply MUST 只写直接父源并先保存父源，再消费当前层覆盖；结构操作 Apply 到父 Variant 时 MUST 原样
并入父源操作列表，Apply 到 Base 时 MUST 由同一 Applier 落到 Base 文档。Revert MUST 只删除当前层操作。
源 revision 更新 MUST 由用户确认，冲突不得自动丢弃或产生半解析快照。

#### Scenario: Apply 到直接父源

- **WHEN** 用户将覆盖 Apply 到 Base 或直接父 Variant
- **THEN** 父源先保存，发起层随后消费覆盖并刷新 lineage 与快照
- **AND** 其他依赖实例只进入 pending-update

#### Scenario: Apply 实例结构操作

- **WHEN** 用户把实例层结构操作 Apply 到直接父源
- **THEN** 操作无需有损转换即并入父源，发起实例随后清除该操作并刷新快照

#### Scenario: Apply 部分成功

- **WHEN** 父源写入成功但发起层保存或场景事务失败
- **THEN** 系统不回滚父源，保留本地覆盖以维持视觉并返回 partial success

#### Scenario: Revert 当前层

- **WHEN** 用户 Revert 字段、移除、移动或新增子树操作
- **THEN** 只删除当前层对应操作并恢复继承结果
- **AND** 新增子树存在依赖操作时先展示依赖并请求确认

#### Scenario: 更新存在冲突

- **WHEN** 最新父链使操作目标或锚点失效
- **THEN** 用户可以保留旧快照，或确认丢弃列出的冲突后一次提交新状态

### Requirement: 实例层结构覆盖

系统 MUST 让 `component-instance` 以与 Variant 同构的稳定操作表达结构覆盖，包括字段 set/remove、
非基础 Component add/remove、Entity 子树 add/remove 与 reparent/reorder；数组按包含它的完整字段原子
处理。实例操作 MUST 与 Variant 操作共用同一校验器与边界约束，解析后的文档 MUST 通过 v6 校验。

#### Scenario: 结构操作与属性覆盖分区保存

- **WHEN** 实例同时存在结构编辑与暴露属性修改
- **THEN** instanceOverrides 分别保存结构操作与 property ID 覆盖
- **AND** 解析顺序为 Base → 从根到叶的 Variant → 结构操作 → 属性覆盖

#### Scenario: 共用边界校验

- **WHEN** 实例操作试图删除实例根、删除基础 Component 或把实体 reparent 出实例子树
- **THEN** 操作以与 Variant 层一致的稳定 issue 被拒绝

#### Scenario: 旧实例数据显式迁移

- **WHEN** 读取仅含 propertyOverrides 的既有实例
- **THEN** 显式纯迁移将其转为 instanceOverrides 的属性分区且结构分区为空，渲染输出不变
- **AND** Parser 不静默接受旧字段

