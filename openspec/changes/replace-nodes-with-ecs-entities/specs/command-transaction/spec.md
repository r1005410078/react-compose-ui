## MODIFIED Requirements

### Requirement: Entity 与 Component 内置命令

Core MUST 提供 Entity 创建、删除、复制、重命名、层级移动以及 Component 添加、移除和更新命令。
旧 `node.*` 与 `frame.*` 命令 MUST 被移除。成功命令 MUST 生成 entities/Components 路径的可逆
Patch，并继续形成唯一正式事务。

#### Scenario: 原子修改 Component

- **WHEN** 宿主添加、更新或移除一个允许修改的 Component
- **THEN** 运行时提交一个可撤销事务并更新对应 Entity
- **AND** undo/redo 精确恢复 Component 与 Composition

#### Scenario: 保护基础 Component

- **WHEN** 命令尝试移除 Composition 或 Composition.baseComponentKeys 中的 Component
- **THEN** 命令被拒绝且文档与历史不变

### Requirement: 受约束 Transform 命令

Transform 命令 MUST 声明 `move|resize|rotate|set` 操作，拒绝锁定 Entity、非法字段变化和违反
TransformConstraints 的结果。多目标手势 MUST 继续由一次命令原子提交。

#### Scenario: 拒绝绕过几何限制

- **WHEN** 外部命令尝试移动不可移动、Resize 被禁用或旋转被禁用的 Entity
- **THEN** Core 拒绝命令而不依赖 Stage UI

#### Scenario: 提交合法多选变换

- **WHEN** Stage 提交多个 Entity 的最终局部 Transform
- **THEN** 运行时生成一个事务并允许一次 undo 恢复全部目标

### Requirement: 能力原子事务

Capability 添加和移除 MUST 由 Registry 规划为一个 transaction.batch，同时修改能力 Components
与 Composition.capabilityIds。任一子操作失败时 MUST 不产生部分文档或历史。

#### Scenario: 添加多 Component 能力

- **WHEN** 用户给 Entity 添加“容器”能力
- **THEN** Hierarchy、Clip 和 capabilityIds 在同一事务中出现

#### Scenario: 能力事务失败

- **WHEN** 目标被锁定、存在冲突或任一 Component 无效
- **THEN** 整个 batch 被拒绝且不留下部分 Component

## ADDED Requirements

### Requirement: batch 命令构造器

core MUST 提供 createComposeBatchCommand，从类型化子命令数组构造 transaction.batch 命令，
调用方 MUST NOT 需要自行对子命令做 JSON 类型强转。

#### Scenario: 构造可执行的原子 batch

- **WHEN** 调用方传入子命令数组与 meta
- **THEN** 返回的命令经 dispatch 后原子应用全部子命令
