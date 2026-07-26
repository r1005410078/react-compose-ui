# @compose-ui/preview

独立的 Compose 文档预览入口。Preview 复用 ComposeComponentRegistry renderer，但自行建立普通
DOM Frame 树，不依赖 editor/stage。它接受 `schemaVersion: 3` 文档，但忽略 `canvas` 编辑元数据，
不会渲染网格、标尺、辅助线、世界坐标轴、选区、手柄或滚动条。

```tsx
import { ComposePreview } from '@compose-ui/preview'

<ComposePreview
  document={runtime.document}
  registry={registry}
  assetResolver={assetResolver}
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
Image/SVG 等资源 renderer 通过可选 `assetResolver` 读取文档引用的最新内容；缺少 resolver 或
会话 Provider 未重连时显示物料定义的可访问缺失占位。

`document` 与 `registry` 均为必填；Preview 不再提供 `children` 容器模式。
