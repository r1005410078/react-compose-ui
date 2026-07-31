# @compose-ui/layout-engine

React 与 DOM 无关的 ComposeDocument v6 布局求解器。包内通过 `yoga-layout/load` 单例异步加载
Yoga WASM，维护 Entity ID 到 Yoga Node 的会话级映射，并只向外发布 Core 定义的
`ComposeLayoutSnapshot`；Yoga 类型、Node 和 WASM 指针不会进入公共 API。

```ts
import { createComposeLayoutRuntime } from '@compose-ui/layout-engine'

const runtime = createComposeLayoutRuntime({ document, measurementPort })
const unsubscribe = runtime.subscribe(() => {
  const state = runtime.getState()
  if (state.status === 'ready') render(state.snapshot)
})

runtime.updateDocument(nextDocument)
unsubscribe()
runtime.dispose()
```

Runtime 固定使用 Web defaults、LTR 与 `pointScaleFactor: 0`。Snapshot 和测量诊断是运行时状态，
不会写入 ComposeDocument、History 或 Operation Log。宿主必须在会话结束时调用 `dispose()`。

Flow 子项的 Fixed 主轴明确使用 `shrink: 0`；Fill 主轴映射为 `grow: 1 / basis: 0 / shrink: 1`，
Fill 交叉轴映射为 stretch。Absolute、根级和自由父级不接受 Fill，这些组合会在 Core 校验阶段
被拒绝。
