## ADDED Requirements

### Requirement: 手势期预览求解通道

Layout Runtime MUST 提供瞬态预览求解入口：宿主提交预览文档后 Runtime 发布带预览标记的
Snapshot；清除预览或收到下一次正式 `updateDocument` 时 MUST 回到最后一次正式提交的求解结果。
预览求解 MUST NOT 产生文档事务、MUST NOT 改变正式提交状态，Yoga 对象仍 MUST NOT 进入公共 API。

#### Scenario: 预览求解不污染提交态

- **WHEN** 宿主在 resize 手势期间提交预览文档并在取消时清除预览
- **THEN** 预览期间发布带预览标记的 Snapshot，清除后订阅方收到最后一次正式提交的 Snapshot
- **AND** TransactionRuntime 与历史全程无新增条目

#### Scenario: 正式提交隐式终止预览

- **WHEN** 预览生效期间到达一次正式 `updateDocument`
- **THEN** Runtime 按正式文档求解并发布不带预览标记的 Snapshot
- **AND** 此前的预览状态被丢弃

### Requirement: 增量重解性能

Runtime 重新求解时 MUST 跳过对象引用未变且父级 Layout 未变的 Entity 的样式重写与重新测量，
measurement 结果 MUST 按输入缓存（port revision 失效仍走既有失效路径），单次重解成本 MUST 与
变更子树规模成正比而不是文档 Entity 总量。发布 Snapshot 时对值未变的 box MUST 复用上一
Snapshot 的对象，使订阅方的相等性检查生效。

#### Scenario: 单节点变更不重写全树样式

- **WHEN** 提交的新文档中只有一个 Entity 及其祖先链的对象引用发生变化
- **THEN** 引用未变的 Entity 不经历样式重写，也不重新调用 measurement port
- **AND** 求解结果与全量重写路径一致

#### Scenario: 未变化 box 保持引用相等

- **WHEN** 一次重解后某 Entity 的布局结果数值与上一 Snapshot 相同
- **THEN** 新 Snapshot 中该 Entity 的 box 与上一 Snapshot 是同一对象
- **AND** 数值变化的 box 仍产生新的冻结对象
