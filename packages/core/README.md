# @compose-ui/core

React Compose UI 的 React/DOM 无关领域内核。

它提供：

- `schemaVersion: 3` 的规范化 JSON `ComposeDocument`、输出/画布设置与结构校验；
- `set`、`insert`、`remove`、`move` 原子可逆 Patch；
- 可注册同步 handler 的 `TransactionRuntime`；
- undo、redo、navigate、750ms `mergeKey` 合并、100 条默认历史和 `reset`；
- 隐式 Canvas 根、统一 Frame 容器、Component 叶节点及其结构、样式、变换与原子 batch 命令。
- `canvas.configure` 与 `canvas.guide.create/move/delete` 画布命令及精确 inverse Patch。
- `output.configure`、Frame 裁剪以及以透明 Frame 实现的组合/解除组合命令。

```ts
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createTransactionRuntime,
  validateComposeDocument,
  type ComposeDocument,
} from '@compose-ui/core'

const result = validateComposeDocument(candidate)
if (!result.valid) {
  console.error(result.issues)
}

const runtime = createTransactionRuntime({
  document: candidate as ComposeDocument,
})

const emptyDocument: ComposeDocument = {
  schemaVersion: 3,
  canvas: createDefaultCanvasSettings(),
  output: createDefaultOutputSettings(),
  rootIds: [],
  nodes: {},
}

const dispatched = runtime.dispatch({
  id: crypto.randomUUID(),
  type: 'node.rename',
  payload: { nodeId: 'heading', name: '季度销售额' },
  meta: {
    label: '重命名标题',
    source: 'scene-tree',
    targetIds: ['heading'],
  },
})
```

`dispatch` 同步返回 `committed | noop | rejected`。只有 committed 改变文档并进入 History；
持久化、审计和网络调用应订阅 `subscribeEvents` 后在 runtime 外执行。订阅者失败不会回滚已经
提交的事务。

文档只保存 JSON 数据，不保存 React renderer、DOM 引用、Inspector 或注册表实例。选择、
场景树展开、工具模式和 Stage 视口属于宿主会话状态。`canvas.grid`、`canvas.smartSnap` 与全局
世界坐标 `canvas.guides` 是文档数据，会随事务进入 undo/redo 和宿主审计边界。
`parentId: null` 表示不写入 `nodes`、不可变换的隐式 Canvas；`rootIds` 可同时包含 Frame 和
Component，Frame 可递归包含 Frame/Component，Component 始终是叶节点。默认 output 为
固定世界原点的 `1280×720` 透明区域；Stage 可以把其边界作为独立检查目标，但它不会进入
`selectedIds`、ComposeSceneTree 或节点命令。

`ComposeNodeBase.style` 是兼容旧文档的可选部分对象。`resolveNodeStyle(node)` 按节点 kind 补齐
背景、边框、圆角、透明度和单层结构化 shadow；`node.style.set/reset` 支持路径更新、锁定拒绝、
noop、undo/redo 和 `transaction.batch`。
