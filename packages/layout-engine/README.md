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

Hug 轴不向 Yoga 写入确定尺寸：Auto Layout 容器由 Flow children、padding、gap 与 border 求得
border box，Renderer leaf 安装同步 measure callback。measurement port 的精确 Entity 失效只
`markDirty()` 对应 leaf，由 Yoga 向祖先传播；缺失、准备中、失败或非法测量按轴使用
`LayoutItem.value`，并把可恢复原因写入 Snapshot diagnostics。

`yoga-layout/load` 通过动态 import 单例加载，因此应用构建产物只有一份惰性 Yoga/WASM 载荷；
Editor、Preview 和嵌套 Page Slot 的 Runtime 共享同一个模块 Promise，但分别拥有可释放的 Config
与 Node 树。
