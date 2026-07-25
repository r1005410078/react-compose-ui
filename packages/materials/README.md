# @compose-ui/materials

Frame、Rectangle 与 Text 的第一方 Inspector 通过 `@compose-ui/ui-context` 生成当前语言的内建
Schema 标题，并由 PropertyPanel 消费共享主题 token。切换主题或语言不会重新创建 registry，
宿主扩展 definition、label、自定义 Inspector 与自定义 Schema metadata 保持原文。

Frame、Rectangle 与 Text 的独立基础物料包。它组合 core 文档样式、component-registry、
Stage Frame preset 与 PropertyPanel Inspector，但不依赖 editor。

```tsx
import { createBasicMaterials } from '@compose-ui/materials'
import '@compose-ui/materials/styles.css'

const materials = createBasicMaterials({
  extensions: [echartsDefinition],
})

const controller = useComposeEditorController({
  runtime,
  registry: materials.registry,
  framePresets: materials.framePresets,
  containerInspector: materials.ContainerInspector,
})
```

`createBasicMaterials` 每次返回独立 registry。Component Library 顺序固定为 Frame preset，
然后 Rectangle、Text，最后按输入顺序追加 `extensions`。Frame、Rectangle 和 Text 均可覆盖
`label`、新节点 `name`、尺寸、默认 props/style。

通用视觉字段保存在 `node.style`。Text 的内容、文字颜色和字号保存在 props；Rectangle 新节点
props 为空。无 `node.style` 的旧 Rectangle 仍从 `color`、`opacity`、`cornerRadius` props
读取视觉值，首次 Inspector 编辑会写入标准 style，但不会删除旧 props。
