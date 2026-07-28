# @compose-ui/materials

Frame、Rectangle、Text、Image 与 SVG 的第一方 Inspector 通过 `@compose-ui/ui-context` 生成当前语言的内建
Schema 标题，并由 ComposePropertyPanel 与 `@compose-ui/components` 的共享 Color Picker 消费同一主题 token。切换主题或语言不会重新创建 registry，
宿主扩展 definition、label、自定义 Inspector 与自定义 Schema metadata 保持原文。

五种独立基础物料组合 core 文档样式、assets resolver、component-registry、Stage Frame preset
与 ComposePropertyPanel Inspector 和 `@compose-ui/components` 样式，但不依赖 editor 或包含 Monaco 的 asset-browser。

```tsx
import { createComposeBasicMaterials } from '@compose-ui/materials'
import '@compose-ui/materials/styles.css'

const materials = createComposeBasicMaterials({
  extensions: [echartsDefinition],
})

const controller = useComposeEditorController({
  runtime,
  registry: materials.registry,
  framePresets: materials.framePresets,
  containerInspector: materials.ContainerInspector,
})
```

`createComposeBasicMaterials` 每次返回独立 registry。Component Library 顺序固定为 Frame preset，
然后 Rectangle、Text，最后按输入顺序追加 `extensions`；Image/SVG 虽已注册但通过
`paletteHidden` 隐藏，只能由兼容资源拖入创建。五种物料均可覆盖
`label`、新节点 `name`、尺寸、默认 props/style；Frame preset 还可通过
`defaultClipContent` 覆盖默认裁剪行为，默认值为 `true`。

通用视觉字段保存在 `node.style`。Text 的内容、文字颜色和字号保存在 props；Rectangle 新节点
props 为空。无 `node.style` 的旧 Rectangle 仍从 `color`、`opacity`、`cornerRadius` props
读取视觉值，首次 Inspector 编辑会写入标准 style，但不会删除旧 props。
Container Inspector 只接受 Frame，并同时编辑 rotation 与 `clipContent`。

Inspector 不再分别实现各物料的宽高、坐标或颜色控件，而是直接使用 Property Panel 的语义类型：
`position: Vector2`、`size: Size`、`rotation: Angle`、`visible: Visibility`；背景、边框、阴影、
文字和 SVG 填充/描边使用 `Color`，阴影偏移使用 `Vector2`。这只重组 Inspector 表单，仍适配回原有
transform、style 和 props command payload，并保留单个原子 batch 与旧 Rectangle `style` fallback。
五种物料的 Visibility 均派发既有 `node.set-visibility`，不会改写节点的 props、style 或 transform。
Color 行只显示共享 Picker 的色块；无论属性行还是弹层都不会显示 CSS 颜色字符串。现有复杂 CSS 色值仍可
读取和预览，用户主动选择后才归一化为不透明 HEX 或 `transparent`。

Image props 保存稳定资源引用、`alt` 和 `fit`，使用 Blob URL 渲染并在更新/卸载时回收。
SVG props 额外支持填充和描边覆盖；原始 SVG 先经 DOMPurify SVG profile 与严格白名单净化，
剥离脚本、事件、动画、嵌入样式和外部 URL，只有净化后的内容才会内联。缺少 resolver 或资源
失效时显示可访问占位，节点仍可选择、移动和删除。
