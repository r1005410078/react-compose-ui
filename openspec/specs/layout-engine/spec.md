# layout-engine Specification

## Purpose
TBD - created by archiving change add-layout-runtime-v6. Update Purpose after archive.
## Requirements
### Requirement: 无 React 的增量 Layout Runtime

Layout Runtime MUST 接受 core measurement port，为 Hug leaf 安装同步 Yoga measure/baseline callback，
并在 port revision 变化时只 dirty 对应 leaf 与祖先。缺少结果或测量失败 MUST 使用 axis value 并产生
Snapshot diagnostic，不得抛弃其余布局。

#### Scenario: 异步测量完成后重排
- **WHEN** Hug leaf 首次使用 fallback，随后 measurement port 发布新的 ready revision
- **THEN** Runtime 重新测量受影响 leaf 并生成新 Snapshot revision
- **AND** 文档引用、TransactionRuntime 与历史保持不变

#### Scenario: 测量失败并恢复
- **WHEN** 自定义 measurer 抛错后输入或准备 revision 改变并返回合法尺寸
- **THEN** 首次 Snapshot 使用 fallback 与 diagnostic，后续 Snapshot 使用恢复尺寸并清除 diagnostic
- **AND** 其他未受影响子树不被重建

### Requirement: 确定的运行时状态

Runtime MUST 以 loading、ready 或 error 描述引擎状态，允许注入 loader，并在失败时保留明确错误而
不是生成旧 Transform fallback。

#### Scenario: Yoga 加载失败
- **WHEN** 注入的 engine loader 拒绝
- **THEN** Runtime 进入 error 并通知订阅方
- **AND** 不产生伪 Snapshot 或文档事务

### Requirement: Auto Layout 交叉轴拉伸继承

Layout Runtime MUST 让 Flow 子级的 `alignSelf: auto` 按标准 Flexbox 语义继承父级 `alignItems`，
包括交叉轴为 Hug 的子级——Hug 交叉轴 MUST 保持未设置（Yoga auto）状态，MUST NOT 无条件覆盖为
`flex-start` 或任何其他固定值。子级显式设置了非 `auto` 的 `alignSelf` 时 MUST 优先于父级
`alignItems` 生效，这是子级跳出父级拉伸的唯一途径，不需要额外的数据字段或级联写入。

#### Scenario: 父级拉伸时 Hug 子级跟随拉伸

- **WHEN** 容器 `alignItems` 为 `stretch`，其一个 Flow 子级交叉轴为 Hug 且 `alignSelf` 为 `auto`
- **THEN** 该子级交叉轴尺寸拉伸到容器可用空间
- **AND** 不需要修改该子级的 `LayoutItem` 数据即可生效

#### Scenario: 子级显式对齐方式优先于父级拉伸

- **WHEN** 容器 `alignItems` 为 `stretch`，其一个 Flow 子级显式设置 `alignSelf` 为 `flex-start`
- **THEN** 该子级按自身设置对齐，不拉伸
- **AND** 同容器内其他 `alignSelf` 为 `auto` 的子级仍正常拉伸

#### Scenario: 父级为非拉伸对齐时 Hug 子级保持内容尺寸

- **WHEN** 容器 `alignItems` 为 `flex-start`、`center` 或 `flex-end`，其一个 Flow 子级交叉轴为 Hug
  且 `alignSelf` 为 `auto`
- **THEN** 该子级交叉轴尺寸由内容决定，按父级对齐方式定位，不被拉伸

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

