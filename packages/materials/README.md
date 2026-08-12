# @compose-ui/materials

Group、Container、Rectangle、Text、Image、SVG 与 Component Instance 的第一方 Entity Presets、Renderer、Component
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

Registry 还注册两个隐藏 Preset：`group` 只提供无外观的结构包装；`component-instance` 保存项目
组件稳定引用、resolved snapshot 和公开属性覆盖。组件实例通过独立 Layout Runtime 渲染嵌套 v6
文档，Provider 离线时继续使用快照；循环或超过八层时显示错误占位，卸载会释放 Runtime 与测量资源。

- Container：`Transform + Visibility + Lock + Hierarchy + Layout + Clip + Appearance`。
- Rectangle/Text/Image/SVG：
  `Transform + Visibility + Lock + Appearance + Renderer`。

Preset 会写入明确的 `Appearance`，不存在基于 `kind` 的默认样式或旧 Rectangle fallback。
Renderer props 只保存物料内容；通用位置、尺寸、可见性、锁定和外观由对应 ECS Component
统一管理。

内建“容器”能力为已有 Renderer Entity 添加 `Hierarchy + Layout + Clip`，使它既渲染自身内容又容纳
子项；有子项时不能移除。“几何限制”能力添加 `TransformConstraints`。Container Preset 自带的
Hierarchy/Layout/Clip 属于基础组合，始终不可移除。

Inspector 由 Editor 按 Registry 顺序聚合。Renderer Definition 显式声明 Props 分类：Text 使用
“文本”和“排版”，Image、SVG 与 Page Slot 分别使用自己的同名分类；未分类 Prop 才进入 Editor 的
“高级”。所有可编辑 value Prop 保留 Schema 类型控件并在同一行追加绑定入口。颜色继续复用 Property
Panel 的 `Color` Renderer 与共享 Color Picker。Image 使用稳定资源引用，SVG 内容先经 DOMPurify
白名单净化。包不依赖 editor、stage 或 asset-browser。

Layout 属性区紧跟变换分组，以两行三列卡片提供方向、换行、间距、多行、主轴与交叉轴控件；
中文标题下显示对应 CSS 属性名。枚举按钮使用统一大小的浏览器语义图标，并随当前方向旋转主轴、
交叉轴和换行示意。padding 以独立“内边距”属性编辑，并与基础外边距共享单值及 T/R/B/L 展开
交互。标题栏提供 `display: flex` 状态和整体重置，末尾只读实时预览显示当前摘要、编号节点与
主轴/交叉轴，不再包含 padding 输入；三个节点使用低对比扁平样式。再次点击已选的非默认 Flex
选项会恢复对应的显式 CSS 初始等价值，默认值使用中性弱选中样式。缺少 Layout 时显示可折叠的
紧凑启用引导，并与标题栏加号复用同一添加命令。该预览仅用于解释属性；正式 Stage 和 Preview 都消费 Layout Runtime 的
Snapshot，并始终以绝对定位 DOM 呈现，不再运行第二套 CSS Flex。LayoutItem 提供
合并进“基础”的复合几何 Inspector：Absolute 的 X/Y 使用 Materials Position 自定义类型，Flow 显示
独立 alignSelf 字段，旋转使用独立 Angle 类型；W/H 以单一智能输入同行编辑：数字隐式表达
Fixed，聚焦后出现当前上下文合法的英文 `Fill`/`Hug` 建议，也可直接键入模式。margin 默认联动
并可展开 T/R/B/L；Flow/Absolute 由 Scene Tree 与 Stage 交互维护，不在基础区手动切换。

Text、Image、SVG 与 Page Slot Renderer 同时提供 Hug measurement definition。Text 使用与可见
Renderer 相同的 typography 在隔离离屏 host 中测量，并订阅 `document.fonts`；Image 使用 resolved
asset natural size；SVG 读取 width/height 或 viewBox；Page Slot 使用目标 v6 页面 output。后三者
按稳定引用订阅 revision，准备中或失败时由 Runtime 使用 LayoutItem fallback。Rectangle 等没有
intrinsic size 的物料不伪造测量结果，会发布明确 fallback diagnostic。

Text 的 text/color/fontSize/fontFamily/fontWeight/letterSpacing/lineHeight，Image 与 SVG 的全部资源和
显示 Props，以及 Page Slot 的 page 都声明完整顶层 value Contract。Text 的全部 value Props 及其他
已有 Inspector 字段从同一 feature-local Schema 构造类型控件与绑定校验，并在原字段行内显示绑定入口；
只有 method 或确实没有字面 editor 的公开字段才在所属 Props 分类显示 binding-only 入口；
Text.text 可接收 setup 返回的 string/number。Page Slot 加载完整页面聚合，并为每个 Slot 独立创建
setup scope；同一页面出现两次也不会共享 State。嵌套卸载、引用或
脚本 revision 变化会释放旧 scope，循环与深度护栏继续在加载前阻断。

所有第一方物料的 `Appearance.backgroundPaint` 都使用结构化 Compose Paint。Appearance Inspector 通过
共享 `paint` editor 打开背景填充；在 Editor 中，它会连接 Stage 的渐变控制柄和图层取色 session，而
materials 本身仍只依赖 Registry 的 `ComposePaintEditPort`，不反向依赖 Editor 或 Stage。
