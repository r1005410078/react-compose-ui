## ADDED Requirements

### Requirement: 无 React 的增量 Layout Runtime

系统 MUST 提供只依赖 core 与官方 Yoga binding 的 `@compose-ui/layout-engine`。Runtime MUST 异步加载
一次 WASM，以 Entity ID 维护可释放的 Yoga 树，并从 v6 文档生成不可变 Layout Snapshot。公共 API
MUST NOT 暴露 Yoga 对象、React、DOM 或浏览器事件。

#### Scenario: 加载并计算 Fixed Flex
- **WHEN** Runtime 收到包含嵌套 Layout、Fixed Flow、Absolute、padding、gap 和 border 的 v6 文档
- **THEN** ready Snapshot 为每个可渲染 Entity 返回 parent-local x/y/width/height
- **AND** rotation 不改变 Yoga box，连续 point 坐标不被像素取整

#### Scenario: 更新和释放 Yoga 树
- **WHEN** 文档只修改一个子树、删除 Entity、替换文档或 dispose Runtime
- **THEN** 只使必要节点与祖先失效并递增 Snapshot revision
- **AND** 被删除节点、整棵旧树、Config 与订阅都被释放

### Requirement: 确定的运行时状态

Runtime MUST 以 loading、ready 或 error 描述引擎状态，允许注入 loader，并在失败时保留明确错误而
不是生成旧 Transform fallback。

#### Scenario: Yoga 加载失败
- **WHEN** 注入的 engine loader 拒绝
- **THEN** Runtime 进入 error 并通知订阅方
- **AND** 不产生伪 Snapshot 或文档事务

