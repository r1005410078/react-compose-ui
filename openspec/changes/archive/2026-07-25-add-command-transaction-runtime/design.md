## 上下文

现有示例把组件数据、场景树节点和属性值拆成多份状态，并在各事件处理器中手工调用
`history.commit` 与 `operationLog.record`。`@compose-ui/core` 仍是占位包，而项目约束要求正式
文档与命令协议保持 React/DOM 无关。后续无限 Stage、组件注册和 Preview 都需要共享同一份
可序列化文档。

## 目标/非目标

- 目标：稳定首版 JSON 文档拓扑、变换与组件属性边界。
- 目标：让同步命令经过校验后原子地产生可逆事务。
- 目标：以事务时间线驱动撤销、重做和任意历史跳转。
- 目标：让成功审计与 Command 调试只需订阅统一事件，不再散落在每个 UI handler。
- 非目标：协作编辑、服务端持久化、异步命令、数据源语义、响应式断点和 Stage 交互。

## 决策

### 文档模型

- `ComposeDocument` 使用 `schemaVersion: 1`、`rootIds` 和规范化 `nodes`。
- `ComposeNode` 是 `frame | group | component` 判别联合。Frame 与 Group 保存 `childIds`；
  Component 保存稳定 `componentType` 与 `JsonObject` props。
- 每个节点保存名称、可见/锁定状态和 `NodeTransform`。Transform 相对父节点；无限空间允许负
  `x/y`，`width/height` 必须为有限正数，Frame rotation 固定为零。
- Frame 只能作为根节点；Group 与 Component 必须且只能从一个 Frame 子树可达。文档不保存
  React 元素、Schema、renderer、函数或类实例。
- `validateComposeDocument` 返回判别结果与稳定 issue code/path，不因普通无效输入抛异常。

### Patch 与命令

- Patch 使用 `set`、`insert`、`remove`、`move` 四种封闭操作表达 JSON 文档修改。命令处理器只
  返回 forward Patch intent；运行时在当前文档上应用时捕获旧值并生成精确 inverse。
- `EditorCommand` 由稳定 ID、字符串 type、JSON payload 和可选 meta 组成。meta 提供
  `label`、`source`、`targetIds` 与 `mergeKey`，不保存 React 或回调。
- `CommandHandler` 是纯同步协议。handler 可以返回 Patch、noop 或带稳定 code/message/path 的
  rejection；运行时还会在应用全部 Patch 后重新校验候选文档。
- handler 抛异常属于程序错误，运行时将其转换为 `rejected` 事件并保持文档不变；不会把错误
  Patch 或部分结果暴露给订阅者。
- 注册重复 command type 必须失败；外部 handler 不得覆盖内置命令。

### 事务与历史

- 每次成功且实际改变文档的 dispatch 生成一个 `EditorTransaction`，包含 command 摘要、
  forward/inverse Patch、提交前后文档版本、事务 ID 和时间。
- `dispatch` 同步返回 `committed | noop | rejected`。只有 committed 更新文档与普通事务历史。
- 相同 `mergeKey`、位于时间线末端且在默认 750ms 内的事务合并为同一历史条目：保留第一次
  修改前 inverse 和最后一次修改后的 forward，并发出带 `coalesced: true` 的成功事件。
- 默认保留 100 个可撤销事务；裁剪后最早可达文档成为新基线。历史中间提交会裁剪 redo 分支。
- undo/redo/navigate 应用已经记录的 inverse/forward，不追加历史条目，但发出成功导航事件，
  供审计层记录实际发生的文档修改。
- `reset` 校验并替换文档、清空历史及事件缓冲，不作为编辑事务；无效文档返回 rejection。
- ID factory 与 clock 可注入，保证测试确定性。运行时只执行同步状态变更；事件订阅者的异步失败
  不得回滚已提交事务。

### 历史和日志边界

- core 不依赖 `@compose-ui/history`，但暴露的事务历史控制器在字段和方法上满足
  `HistoryNavigationController`，因此现有 `HistoryPanel` 与快捷键无需修改。
- `useHistory<T>` 保留，供不采用正式文档运行时的独立宿主继续使用。
- core 不依赖 `@compose-ui/operation-log`。示例在一个桥接订阅器中把 committed 与历史导航事件
  映射为 `record` 输入；noop/rejected/reset 不进入操作日志。

### Command 调试台

- `@compose-ui/command-panel` 依赖 core 公共协议并把 React 作为 peer dependency。
- 面板订阅外部 runtime，显示当前挂载会话内最近 100 个 committed/noop/rejected 事件。
- `CommandPreset` 用有限字段描述器声明 string、number、boolean、select 和 JSON 输入；宿主负责
  把有效字段值构造为 `EditorCommand`。
- 表单只派发结构化命令，不提供自然语言解析、`eval` 或脚本执行。

## 风险/权衡

- 正式 Schema 过早膨胀 → 首版只包含树拓扑、通用 transform 和 JSON props，数据源与发布协议后置。
- 通用 Patch 可能弱化领域约束 → 所有 built-in 与自定义 handler 结果都必须经过完整文档校验。
- 高频属性输入产生历史噪声 → 使用显式 mergeKey 和短时间窗，结构操作永不隐式合并。
- 事务事件的异步日志写入可能失败 → 文档提交优先，日志沿用现有 degraded 状态且不反向回滚。
- 快照历史与事务历史并存 → 两者保持不同入口；controller 驱动的正式编辑器只使用事务历史，
  `useHistory` 仅作为兼容的独立能力。

## 迁移计划

1. 新增 core 协议和运行时，不修改现有编辑器公共属性。
2. 新增 CommandPanel，并在示例中以 runtime controller 驱动现有 HistoryPanel。
3. 将示例场景树操作、属性变更和工具栏新增逐项迁移为命令。
4. 将多处分散日志记录替换为一个事务事件桥接器。
5. 后续 `add-infinite-stage-composition` 在不改变文档协议的前提下接入 Stage。

没有持久化数据迁移；当前示例状态会由确定性的 `ComposeDocument` fixture 替换。

## 待解决问题

无。Stage 渲染、组件注册和 Pointer 手势由依赖变更 `add-infinite-stage-composition` 规范化。
