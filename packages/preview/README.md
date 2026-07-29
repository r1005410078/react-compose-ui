# @compose-ui/preview

独立的 `ComposeDocument v4` 预览入口。Preview 复用 `ComposeEntityRegistry` Renderer，并自行
建立普通 DOM Entity 树，不依赖 editor 或 stage。

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
  target={{ kind: 'container', entityId: 'desktop' }}
/>
```

省略 `target` 或使用 `{ kind: 'document' }` 时按 `document.output` 渲染完整文档。Container
target 可指向根级或嵌套的 `Hierarchy` Entity。一个 Entity 若同时拥有 `Renderer` 和
`Hierarchy`，Preview 会先渲染自身内容，再渲染子项；`Clip.enabled` 决定容器溢出行为。

Preview 使用与 Stage 相同的 `Transform`、`Appearance`、`Visibility` 与层级语义，不渲染网格、
标尺、选区或手柄。未知 Renderer 显示 Registry 的可访问占位；资源 Renderer 通过可选
`assetResolver` 解析稳定引用。
