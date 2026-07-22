# @compose-ui/operation-log

用于记录宿主已经成功应用的数据变更，并在 IndexedDB 中按 `scopeId` 隔离保存。本包不负责
undo/redo、技术诊断日志、服务端同步或防篡改审计，可以独立使用，也可以放入
`ComposeEditor.transactionLogPanel`。

## 安装与样式

```bash
bun add @compose-ui/operation-log
```

React 和 ReactDOM 是 peer dependencies。宿主需要显式加载样式：

```tsx
import '@compose-ui/operation-log/styles.css'
```

## Provider 与面板

```tsx
import {
  OperationLogPanel,
  OperationLogProvider,
  useOperationLog,
} from '@compose-ui/operation-log'
import { ComposeEditor } from '@compose-ui/editor'

function Workspace() {
  const operationLog = useOperationLog()

  const rename = (id: string, before: string, after: string) => {
    // 先成功应用业务数据，再记录；日志失败不会回滚业务状态。
    setComponents((current) => renameComponent(current, id, after))
    void operationLog.record({
      action: 'component.rename',
      category: 'component',
      summary: `重命名 ${before}`,
      targets: [{ componentId: id, componentLabel: after }],
      source: 'scene-tree',
      before,
      after,
    })
  }

  return (
    <ComposeEditor transactionLogPanel={<OperationLogPanel />}>
      <Canvas onRename={rename} />
    </ComposeEditor>
  )
}

export function Page() {
  return (
    <OperationLogProvider scopeId="workspace-42">
      <Workspace />
    </OperationLogProvider>
  )
}
```

Provider 默认每个 scope 保留最近 `1000` 条记录，每个 before、after 或 metadata 快照上限为
`64KiB`。IndexedDB 初始化或写入失败时会自动转为当前会话内存存储，`status` 变为
`degraded`，面板显示“本地持久化不可用”，同时通过 `onStorageError` 通知宿主。

面板按更新时间倒序显示，支持搜索 action、摘要、组件和路径，也支持分类与组件筛选。选择记录后
可查看目标、来源、合并次数及结构化前后值。面板没有清空按钮；需要时宿主可以调用
`useOperationLog().clear()`。

## 连续输入合并

只有宿主显式传入相同 `coalesceKey` 的紧邻记录才会合并：

```ts
void operationLog.record({
  action: 'property.change',
  category: 'property',
  summary: '修改不透明度',
  targets: [{ componentId, path: ['appearance', 'opacity'] }],
  before: previousOpacity,
  after: nextOpacity,
}, {
  coalesceKey: `${componentId}:appearance.opacity`,
  coalesceWindowMs: 800,
})
```

合并记录保留第一次 `before`、最后一次 `after`、最新时间和累计次数。reset、绑定、删除、移动等
必须保持独立的操作不要传 `coalesceKey`；任何中间记录都会终止前一段合并。

## 快照和自定义 store

`createOperationLogSnapshot()` 支持普通对象、数组、Date、BigInt 和 undefined。循环引用、函数、
Symbol 以及不支持的对象会生成 `unavailable` 快照；超出上限时只保存稳定预览、原始字节数和
`truncated` 状态，不会阻断宿主操作。

测试或非浏览器环境可以显式使用内存 store：

```tsx
const store = createMemoryOperationLogStore()

<OperationLogProvider scopeId="test" store={store}>
  <App />
</OperationLogProvider>
```

`createIndexedDbOperationLogStore({ databaseName, storeName })` 可用于隔离不同产品实例。自定义
`OperationLogStore` 只需实现 `load`、`put`、`remove` 和 `clear`。

## 记录边界

推荐记录组件新增/复制/删除/重命名、场景移动、合法属性 change/reset 和绑定
bind/unbind/reset/remap。选择、展开、搜索、面板 resize、未通过 Schema 的草稿和外部变量值刷新
不属于操作审计日志。日志协议不依赖宿主的正式文档 Schema；可读摘要和目标由宿主在成功提交
边界提供。
