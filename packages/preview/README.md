# @compose-ui/preview

独立的 Compose 文档预览入口。Preview 复用 ComponentRegistry renderer，但自行建立普通
DOM Frame 树，不依赖 editor/stage。它接受 `schemaVersion: 3` 文档，但忽略 `canvas` 编辑元数据，
不会渲染网格、标尺、辅助线、世界坐标轴、选区、手柄或滚动条。

```tsx
import { ComposePreview } from '@compose-ui/preview'

<ComposePreview
  document={runtime.document}
  registry={registry}
/>

<ComposePreview
  document={runtime.document}
  registry={registry}
  target={{ kind: 'frame', frameId: 'desktop' }}
/>
```

省略 `target` 或使用 `{ kind: 'document' }` 时按 `document.output` 的固定原点、尺寸和背景输出
完整文档并裁剪边界。Frame target 可指向根级或嵌套 Frame，最外层输出始终裁剪；内部 Frame
按自身 `clipContent` 决定溢出。默认 document output 是透明的；Preview 不会注入 Stage
边框、棋盘格或实色背景。未知 renderer 显示 registry 的可访问错误占位。

Frame 与 Component 通过 core `resolveNodeStyle` 应用与 Stage 相同的通用视觉语义。

为兼容既有宿主，`document` 与 `registry` 均省略时仍渲染 legacy `children`；只提供其中一项时
显示配置错误。
