# @compose-ui/materials

Container、Rectangle、Text、Image 与 SVG 的第一方 Entity Presets、Renderer、Component
Definitions 和 Capabilities。

```tsx
import { createComposeBasicMaterials } from '@compose-ui/materials'
import '@compose-ui/materials/styles.css'

const materials = createComposeBasicMaterials({
  extensions: {
    renderers: [echartsRenderer],
    presets: [echartsPreset],
  },
})

const controller = useComposeEditorController({
  runtime,
  registry: materials.registry,
})
```

Registry 内置 Container、Rectangle、Text、Image、SVG 五种 Preset，全部通过同一个
`ComposeEntityRegistry` 创建，不再区分 Frame Preset 与普通组件。默认 Palette 展示
Container、Rectangle 与 Text；Image/SVG 保留为资源拖入 Preset。

- Container：`Transform + Visibility + Lock + Hierarchy + Clip + Appearance`。
- Rectangle/Text/Image/SVG：
  `Transform + Visibility + Lock + Appearance + Renderer`。

Preset 会写入明确的 `Appearance`，不存在基于 `kind` 的默认样式或旧 Rectangle fallback。
Renderer props 只保存物料内容；通用位置、尺寸、可见性、锁定和外观由对应 ECS Component
统一管理。

内建“容器”能力为已有 Renderer Entity 添加 `Hierarchy + Clip`，使它既渲染自身内容又容纳
子项；有子项时不能移除。“几何限制”能力添加 `TransformConstraints`。Container Preset 自带的
Hierarchy/Clip 属于基础组合，始终不可移除。

Inspector 由 Editor 按 Registry 顺序聚合。Text、Image 和 SVG 只提供 Renderer 内容属性区；
颜色继续复用 Property Panel 的 `Color` Renderer 与共享 Color Picker。Image 使用稳定资源引用，
SVG 内容先经 DOMPurify 白名单净化。包不依赖 editor、stage 或 asset-browser。

所有第一方物料的 `Appearance.backgroundPaint` 都使用结构化 Compose Paint。Appearance Inspector 通过
共享 `paint` editor 打开背景填充；在 Editor 中，它会连接 Stage 的渐变控制柄和图层取色 session，而
materials 本身仍只依赖 Registry 的 `ComposePaintEditPort`，不反向依赖 Editor 或 Stage。
