## ADDED Requirements

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

## MODIFIED Requirements

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
