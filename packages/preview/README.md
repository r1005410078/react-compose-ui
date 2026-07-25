# @compose-ui/preview

# @compose-ui/preview

独立的 Compose 文档 Frame 预览入口。Preview 复用 ComponentRegistry renderer，但自行建立普通
DOM Frame 树，不依赖 editor/stage，也不包含选区、手柄或吸附线。

```tsx
import { ComposePreview } from '@compose-ui/preview'

<ComposePreview
  document={runtime.document}
  registry={registry}
  frameId="desktop"
/>
```

`frameId` 必须明确指向一个 Frame；节点按父级局部 transform 嵌套渲染，hidden 节点不输出，
Frame 使用明确宽高并裁剪溢出。未知 renderer 显示 registry 的可访问错误占位。

Frame、Group 与 Component 通过 core `resolveNodeStyle` 应用与 Stage 相同的通用视觉语义；
Group 保留子节点溢出，Frame 与 Component 保持裁剪。

为兼容既有宿主，三项文档参数均省略时仍渲染 legacy `children`；只提供部分参数时显示配置错误。
