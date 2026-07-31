## 上下文

Yoga Measure Function 是同步回调，但资源、字体和页面文档的准备是异步的。Runtime 必须在无 DOM
的情况下消费稳定缓存，同时 React adapter 负责浏览器测量、资源订阅、取消和迟到结果处理。

## 目标/非目标

- 目标：叶子内容和 Auto Layout 容器可在任意轴 Hug，并与 Fixed/Fill 嵌套。
- 目标：宿主自定义 Renderer 使用与内建物料相同的公共测量协议。
- 目标：准备失败时有稳定 fallback/diagnostic，不修改文档或历史。
- 非目标：不支持 free container 通过 absolute children Hug，不测量已渲染 Scene DOM，不引入 worker。

## 决策

### Hug 语义

- Auto Layout 容器 Hug 由 Flow children、padding、gap 和 border 决定；其自身 Renderer 不贡献尺寸。
- 叶子 Renderer Hug 调用 measurement port。未知/缺失/准备中/失败返回 LayoutItem axis value，并在
  Snapshot diagnostics 中标记 entity、axis 与原因。
- free Hierarchy Entity 不允许 Hug，因为 absolute children 不贡献 Yoga intrinsic size。
- Hug 可用于 root 叶子或 root Auto Layout container；Fill 仍只允许 Flow。
- 直接 resize Hug axis 时沿用第二阶段规则，提交 Fixed final value。

### Measurement 协议

- core 定义 Exactly/AtMost/Undefined constraint、MeasuredSize/baseline 和无框架 port。
- Registry Renderer Definition 可声明 `measurement`：同步 `measure`、可选异步 `prepare` 与 baseline。
- React adapter 根据 entity renderer/props、资源/page reference revision 和 measurement environment 建
  cache key；prepare 使用 AbortController，迟到结果和旧 revision 被丢弃。
- Adapter 以同步 `read` 服务 Yoga callback，以 subscribe/revision 通知 Runtime markDirty。
- Text 使用隔离离屏测量 host，复制同一 renderer props/CSS，不读取 Stage/Preview entity DOM；
  document.fonts ready/loadingdone 增加 environment revision。
- Image/SVG 使用 asset resolver resolve+subscribe；Page Slot 使用 page loader load+subscribe。

### 生命周期与嵌套

- 一份 LayoutRuntime 同时只挂一个 measurement port；Stage 和 Editor controller 共享 Runtime 时由
  Stage surface attach，卸载时 detach。Preview 内部 Runtime 自己拥有 adapter。
- 每个 Page Slot 嵌套文档拥有独立 Runtime/adapter，并继承 registry、asset resolver、page loader、
  engine loader 与循环/深度上下文。
- measurement update 只递增 Snapshot revision；TransactionRuntime、History、Operation Log 不订阅为命令。

## 风险/权衡

- 离屏 Text 测量可能触发布局 flush → 以 constraint+props+font revision 缓存，只测 dirty leaf。
- 异步资源先 fallback 后重排 → 这是明确状态，Preview/Stage 共用协议并以诊断/aria 状态解释。
- 自定义 measurer 抛错 → adapter 隔离错误、保留 fallback 并可在输入 revision 变化后恢复。

