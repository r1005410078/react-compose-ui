## MODIFIED Requirements

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
