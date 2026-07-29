# command-transaction Specification

## Purpose
TBD - created by archiving change add-command-transaction-runtime. Update Purpose after archive.
## Requirements
### Requirement: 同步命令处理器

系统 MUST 在 `@compose-ui/core` 提供可扩展的同步 `CommandHandler` registry。每个
`EditorCommand` MUST 包含稳定 ID、字符串 type、JSON payload 和可选 label、source、targetIds、
mergeKey；handler MUST 返回 forward Patch、noop 或 rejection，不得执行异步提交。

#### Scenario: 注册并执行宿主命令

- **WHEN** 宿主为一个未占用 type 注册同步 handler 并派发匹配命令
- **THEN** handler 收到当前只读文档和完整命令
- **AND** 运行时根据 handler 结果返回 committed、noop 或 rejected

#### Scenario: 拒绝重复命令类型

- **WHEN** 宿主重复注册 type 或尝试覆盖内置 type
- **THEN** registry 明确拒绝注册
- **AND** 原有 handler 保持不变

#### Scenario: 隔离 handler 异常

- **WHEN** handler 抛出异常或返回无效 Patch
- **THEN** dispatch 返回带稳定原因的 rejected
- **AND** 当前文档和历史均保持不变

### Requirement: 原子可逆 Patch

运行时 MUST 支持 set、insert、remove、move Patch，在当前文档上捕获旧值并生成精确 inverse。
全部 forward Patch 应用后 MUST 重新校验候选文档；任何 Patch 或文档校验失败时 MUST 放弃全部修改。

#### Scenario: 原子提交复合修改

- **WHEN** 一个命令同时修改节点 props、名称和场景顺序且全部 Patch 有效
- **THEN** 所有修改作为一个事务同时可见
- **AND** inverse 可以一次恢复完整提交前文档

#### Scenario: 中途 Patch 失败

- **WHEN** 一组 Patch 中后续操作引用不存在的路径或产生无效拓扑
- **THEN** dispatch 返回 rejected
- **AND** 先前已经计算的 Patch 不会泄漏到当前文档、历史或成功事件

#### Scenario: 忽略等价结果

- **WHEN** 有效命令应用后文档与当前文档在业务上相同
- **THEN** dispatch 返回 noop
- **AND** 不创建事务历史条目

### Requirement: 成功事务与事件

实际改变文档的 dispatch MUST 生成 `EditorTransaction`，记录稳定事务 ID、命令摘要、source、
targetIds、forward/inverse Patch、提交时间和提交前后文档版本。运行时 MUST 提供状态订阅和
committed/noop/rejected/history-navigation/reset 事件订阅。

#### Scenario: 发布成功事务

- **WHEN** 命令成功改变文档
- **THEN** dispatch 同步返回 committed 与对应事务
- **AND** 状态订阅者观察到新文档，事件订阅者观察到同一事务 ID

#### Scenario: 发布失败结果

- **WHEN** 命令被 handler 或文档校验拒绝
- **THEN** dispatch 与事件订阅者得到相同的稳定 issue
- **AND** 普通状态订阅者不会观察到文档修改

#### Scenario: 异步订阅者失败

- **WHEN** 成功事件订阅者启动的日志或持久化 Promise 随后失败
- **THEN** 已提交文档和事务历史保持不变
- **AND** 运行时继续接受后续同步命令

### Requirement: 事务撤销重做与跳转

运行时 MUST 以事务 forward/inverse 作为唯一正式历史，提供 entries、activeEntryId、canUndo、
canRedo、undo、redo 与 navigate，并在结构上兼容 `HistoryNavigationController`。导航 MUST
修改文档但不得追加新的历史条目。

#### Scenario: 撤销并重做事务

- **WHEN** 用户依次执行 undo 和 redo
- **THEN** 文档先通过 inverse 恢复到事务前状态，再通过 forward 恢复
- **AND** 历史条目数量和 ID 保持不变

#### Scenario: 跳转多个历史条目

- **WHEN** 用户从当前条目 navigate 到更早或更晚的有效条目
- **THEN** 运行时按顺序应用所需 inverse 或 forward
- **AND** 只发布一次完成后的文档状态与一次导航事件

#### Scenario: 历史中间提交新分支

- **WHEN** 用户撤销到较早条目后派发成功命令
- **THEN** 所有未来 redo 条目被裁剪
- **AND** 新事务成为时间线末端

### Requirement: 历史合并容量与重置

相邻事务仅在当前位于时间线末端、mergeKey 相同且默认 750ms 窗口内时 MUST 合并。运行时默认
MUST 保留 100 个可撤销事务，超限时提升最早可达文档为新基线。`reset` MUST 校验新文档并清空
时间线，不创建编辑事务。

#### Scenario: 合并连续属性输入

- **WHEN** 同一属性在 750ms 内以相同 mergeKey 连续成功提交
- **THEN** 历史只显示一个事务条目
- **AND** undo 恢复第一次输入前的值，redo 应用最后一次输入后的值

#### Scenario: 不合并结构操作

- **WHEN** 相邻事务没有 mergeKey、key 不同、超出窗口或当前不在时间线末端
- **THEN** 每次成功操作保留独立历史条目

#### Scenario: 裁剪历史容量

- **WHEN** 成功事务数量超过配置容量
- **THEN** 最旧不可撤销事务被移出时间线
- **AND** 当前文档和剩余事务仍可正确 undo/redo

#### Scenario: 重置有效或无效文档

- **WHEN** 宿主 reset 为合法文档
- **THEN** 新文档成为无可撤销事务的新基线
- **WHEN** 宿主 reset 为非法文档
- **THEN** reset 返回 rejection 且原文档与历史不变

### Requirement: 确定性运行时依赖

运行时 MUST 允许注入 ID factory、clock、历史容量和合并窗口，并 MUST 在未注入时提供浏览器与
Node 可用的默认实现。

#### Scenario: 注入测试 ID 与时钟

- **WHEN** 测试使用确定性 ID factory 和可控 clock
- **THEN** command、transaction、合并窗口和历史条目的结果可以稳定断言
- **AND** core 不读取 DOM 或 React 生命周期

### Requirement: Stage Engine 空间命令规划

stage-engine MUST 为任意同父级顶层选择创建 Frame-backed group，为任意含孩子 Frame 创建
ungroup，并为 Canvas 或 Frame 目标创建保持世界几何的 reparent/duplicate 命令。

#### Scenario: 在根级组合并解除 Frame

- **WHEN** 根级 Frame/Component 被组合后再解除
- **THEN** group 创建透明且不裁剪的 Frame，ungroup 把孩子提升回 rootIds
- **AND** 两次事务前后的孩子世界几何保持一致

#### Scenario: 拒绝无效组合

- **WHEN** 选择少于两个、不同父级、锁定或 Frame 没有孩子
- **THEN** group/ungroup 被稳定拒绝且文档不变

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

### Requirement: batch 命令构造器

core MUST 提供 createComposeBatchCommand，从类型化子命令数组构造 transaction.batch 命令，
调用方 MUST NOT 需要自行对子命令做 JSON 类型强转。

#### Scenario: 构造可执行的原子 batch

- **WHEN** 调用方传入子命令数组与 meta
- **THEN** 返回的命令经 dispatch 后原子应用全部子命令

