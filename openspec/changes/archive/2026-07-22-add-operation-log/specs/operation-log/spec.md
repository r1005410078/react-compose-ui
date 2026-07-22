## ADDED Requirements

### Requirement: 结构化操作日志协议

系统 MUST 提供独立于编辑器文档 Schema 的结构化日志记录，包含稳定 ID、scope、会话、动作、分类、
摘要、目标、时间、次数及可选前后值和元数据。公共 API MUST 具有完整 TSDoc。

#### Scenario: 记录成功的数据变更
- **WHEN** 宿主成功应用组件、场景结构、属性或变量绑定变更后调用 recorder
- **THEN** 系统生成一条带 scope、session、动作、目标和客户端时间的日志
- **AND** 纯选择、展开、搜索、resize 或未通过 Schema 的草稿不会被自动记录

#### Scenario: 生成可持久化快照
- **WHEN** before、after 或 metadata 包含普通值、Date、BigInt 或 undefined
- **THEN** 系统生成可持久化且可读的标记快照
- **AND** 循环引用、函数或 Symbol 被标记为 unavailable 而不影响操作提交
- **AND** 超过默认 64KiB 的单个快照保存预览、字节数和截断状态

### Requirement: 连续属性操作合并

系统 MUST 只在宿主提供 `coalesceKey` 时合并紧邻的连续记录，并 MUST 保留完整的首尾审计语义。

#### Scenario: 合并同一属性连续输入
- **WHEN** 同 scope、同 session、同 coalesce key 的记录紧邻且间隔不超过 800ms
- **THEN** 系统保留第一条 before、最后一条 after 和最新摘要与时间
- **AND** count 表示被合并的操作次数

#### Scenario: 中断或跳过合并
- **WHEN** key 不同、中间存在其他操作、超过合并窗口或未提供 key
- **THEN** 系统创建独立日志条目
- **AND** reset、绑定和结构操作由宿主省略 key 后始终独立记录

### Requirement: Scoped IndexedDB 持久化

系统 MUST 默认按宿主提供的 `scopeId` 把日志持久化到 IndexedDB，并 MUST 在刷新、scope 切换和
存储失败时保持确定行为。

#### Scenario: 刷新后恢复当前 scope
- **WHEN** 当前 scope 已写入日志且 Provider 重新挂载
- **THEN** 系统按更新时间倒序恢复该 scope 的日志
- **AND** 其他 scope 的记录不会出现在结果中

#### Scenario: 限制每个 scope 的记录数量
- **WHEN** scope 的独立记录超过默认 1000 条
- **THEN** 系统按最旧优先删除超出上限的记录
- **AND** 其他 scope 不受影响

#### Scenario: IndexedDB 不可用时降级
- **WHEN** IndexedDB 初始化、读取或写入失败
- **THEN** 系统继续在当前会话内存中接受和显示日志
- **AND** controller 状态变为 degraded 并调用宿主 `onStorageError`
- **AND** 编辑器数据变更不会因日志失败而中断

#### Scenario: 程序化清理当前 scope
- **WHEN** 宿主调用 controller 的 `clear()`
- **THEN** 系统清空响应式列表和持久化 store 中当前 scope 的记录
- **AND** 默认日志面板不显示清理入口

### Requirement: 可访问日志查看面板

系统 MUST 提供可嵌入 `transactionLogPanel` 的紧凑 React 面板，并 MUST 支持搜索、分类筛选、组件
筛选、条目选择和结构化详情。

#### Scenario: 搜索和筛选日志
- **WHEN** 用户输入查询或选择分类、组件筛选
- **THEN** 列表只显示匹配 action、summary、目标 ID、名称或属性路径的当前 scope 记录
- **AND** 清空筛选恢复按更新时间倒序的完整列表

#### Scenario: 查看结构化详情
- **WHEN** 用户通过 Pointer 或键盘选择一条日志
- **THEN** 面板显示动作、目标、来源、时间、次数、before、after 和 metadata
- **AND** truncated、unavailable 和 degraded 状态具有明确可访问说明

### Requirement: 示例成功提交集成

示例应用 MUST 用真实操作日志替换伪列表，并 MUST 只在宿主成功应用数据变更后记录。

#### Scenario: 记录编辑器纵向操作
- **WHEN** 用户新增、复制、移动、重命名、删除组件，修改或重置属性，或者修改变量绑定
- **THEN** 底部日志按发生顺序显示对应结构化记录
- **AND** 连续编辑同一文本属性只形成一条合并记录

#### Scenario: 页面刷新保留日志
- **WHEN** 用户产生操作日志后刷新示例页面
- **THEN** 当前 demo scope 的日志从 IndexedDB 恢复
- **AND** 列表、筛选和详情继续可用
