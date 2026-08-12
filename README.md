# React Compose UI

React Compose UI 是一组可嵌入 React 项目的低代码 UI 组件，面向需要在客户现场快速搭建和
调整定制化数据大屏的实施工程师与前端开发者。

项目把重复的页面编码工作逐步转化为可视化编排、属性配置、预览和保存发布流程。当前仍处于
基础能力验证阶段：已经具备 ECS 化 JSON 文档、同步命令事务、Entity Registry、无限 Stage、
基础物料、聚合 Inspector、Scene Tree、History、Command/Operation Log、资源浏览、页面系统、
setup 脚本 Props 绑定、first-class Group、项目组件与 Unity 风格 Variant、关联实例和只读 Preview；
动画、数据源与正式发布持久化仍未实现。

## 环境与安装

- React 18.3 或 React 19
- ReactDOM 18.3 或 ReactDOM 19
- ESM 前端构建环境
- 仓库开发使用 Bun 1.3.14

```bash
bun add @compose-ui/core @compose-ui/assets @compose-ui/layout-engine @compose-ui/stage-engine \
  @compose-ui/ui-context @compose-ui/components @compose-ui/script-runtime \
  @compose-ui/component-registry @compose-ui/component-library \
  @compose-ui/stage @compose-ui/materials @compose-ui/editor @compose-ui/preview
```

React 与 ReactDOM 由宿主提供。仓库开发阶段不要假设 npm 中已经存在尚未发布的版本。

## 快速开始

```tsx
import { createDefaultCanvasSettings, createDefaultOutputSettings } from '@compose-ui/core'
import { createTransactionRuntime, type ComposeDocument } from '@compose-ui/core'
import { ComposeEditor, useComposeEditorController } from '@compose-ui/editor'
import { createComposeBasicMaterials } from '@compose-ui/materials'
import { ComposePreview } from '@compose-ui/preview'
import { useMemo } from 'react'
import '@compose-ui/editor/styles.css'

const document: ComposeDocument = {
  schemaVersion: 6,
  canvas: createDefaultCanvasSettings(),
  output: createDefaultOutputSettings(),
  rootIds: [],
  entities: {},
}

export function ComposePage() {
  const runtime = useMemo(() => createTransactionRuntime({ document }), [])
  const materials = useMemo(() => createComposeBasicMaterials(), [])
  const controller = useComposeEditorController({
    runtime,
    registry: materials.registry,
  })

  return (
    <main>
      <ComposeEditor controller={controller} style={{ height: 720 }} />
      <ComposePreview document={runtime.document} registry={materials.registry} />
    </main>
  )
}
```

宿主必须导入 `@compose-ui/editor/styles.css` 并给编辑器确定的非零高度。Dockview 是 editor 的
内部实现；面板对象、布局 JSON、选择、viewport 和临时交互状态都不会写入文档。

使用 `ComposePreviewDialog` 时，宿主还必须导入 `@compose-ui/preview/styles.css`；Dialog 以受控
`open`/`onOpenChange` 组合 `ComposePreview`，可选 `containerId` 用于在完整文档与指定容器之间切换。

viewport 是编辑器会话状态里变化最频繁的一项：一次平移手势每帧都会更新它。为了让平移不牵动
场景树与 Inspector，它存放在外部状态源中——`controller.viewport` 读取始终返回最新快照，但读取
它的组件不会因平移自动重渲。默认工作区的画布与工具栏已内建订阅；自己渲染 `ComposeStage` 或
需要显示缩放读数的宿主，用 `useComposeStageViewport(controller)` 订阅。

## ComposeDocument v6 与 Auto Layout

文档只保存严格 JSON：

```ts
interface ComposeDocument {
  readonly schemaVersion: 6
  readonly canvas: ComposeCanvasSettings
  readonly output: ComposeOutputSettings
  readonly rootIds: readonly string[]
  readonly entities: Readonly<Record<string, ComposeEntity>>
}

interface ComposeEntity {
  readonly id: string
  readonly name: string
  readonly components: Readonly<Record<string, JsonObject>>
}

interface ComposeOutputSettings {
  readonly width: number
  readonly height: number
  readonly backgroundPaint: ComposePaint
}
```

Component Key 强制 PascalCase，字段保持 camelCase。每个场景 Entity 必须拥有
`Composition + Transform + LayoutItem + Visibility + Lock`，并至少拥有 `Renderer` 或 `Hierarchy`。
`Renderer + Hierarchy` 可以同时存在，因此“可渲染容器”不需要继承或特殊节点类型。

`Hierarchy.childIds` 是唯一父子事实来源，`rootIds` 保存顶层顺序。`Composition` 记录 Preset
基础项和已附加 Capability，使能力增删可以可靠保护基础数据。未知合法 Component 会被保留并
降级展示。v5 不会被运行时隐式接受；宿主必须显式调用
`migrateComposeDocumentV5ToV6()`，迁移成功后再保存 v6。没有 v6→v5 或双运行路径。

输出背景使用结构化 `ComposePaint`：`solid`、`linear-gradient`、`radial-gradient` 和
`angular-gradient` 都是同一字段的合法值。v5 的旧 `output.backgroundColor` 已移除，输入文档和
`output.configure` 命令必须传入 `backgroundPaint`。Editor 的 Canvas Inspector 会在同一个紧凑
Paint 面板中切换 Solid 与各类 Gradient；Stage/Preview 会渲染该输出背景，但不把它当作可编辑的
Entity。

## Registry、Preset 与能力

`ComposeEntityRegistry` 统一注册四类定义：

- Renderer：Stage/Preview 渲染实现和可选 Props Inspector。
- Component Definition：默认值、校验、顺序和可选属性区。
- Entity Preset：Palette 项及初始 Component 组合。
- Capability：用户可添加的一组 Component、依赖和冲突。

```tsx
import { createComposeEntityRegistry } from '@compose-ui/component-registry'

const registry = createComposeEntityRegistry({
  renderers: [metricRenderer],
  components: [metricDataComponent],
  presets: [metricPreset],
  capabilities: [containerCapability],
})
```

添加 Capability 会自动补齐依赖并规划为单个 `transaction.batch`；冲突、循环、重复
Component Key、基础项移除和带子项容器移除都会被阻止。Registry 缺失时，未知 Renderer/能力
不会使文档失效。

`@compose-ui/materials` 提供 Container、Rectangle、Text、Image、SVG Presets。Container 默认是
`Hierarchy + Clip` 的自由容器；只有用户在 Inspector 的“布局 +”菜单中显式选择 Auto Layout
后才附加 `Layout`，并在同一事务中把全部直接子项转为 Flow。移除 Auto Layout 时，当前
`ComposeLayoutSnapshot` 会把 Flow 子项和 Hug/Fill 尺寸烘焙回稳定的 Absolute/Fixed 几何。
普通物料是 `Appearance + Renderer`，也可以通过“容器”能力获得子项；“几何限制”能力添加
`GeometryConstraints`。
`Transform` 只持久化 rotation；`LayoutItem` 保存 Absolute/Flow、Fixed/Fill/Hug、offset、margin
和 min/max。`@compose-ui/layout-engine` 使用 Yoga 异步求解，Stage 与 Preview 始终按同一
`ComposeLayoutSnapshot` 绝对定位 DOM，不再以 CSS Flex 或旧 Transform 作为第二布局路径。
Hug 容器由 Flow 子项、padding、gap 与 border 决定；Hug 叶子通过 Registry 的同步
`measurement.measure` 和可选异步 `prepare` 获取内容尺寸。Text 使用隔离离屏 host，Image、SVG
与 Page Slot 分别订阅资源 revision、SVG intrinsic box 与页面 output。准备中或失败时使用
`LayoutItem.value` 并发布 Snapshot diagnostic，资源恢复只增加 Snapshot revision，不进入文档事务。

## Group、项目组件与 Variant

Group 是独立于 Container 的结构 Entity：无 Renderer、Appearance、Clip 或 Layout，可移动但不可
缩放/旋转。创建时保存稳定 frame 和子项局部坐标；Stage 的命中、框选和吸附使用可见后代动态并集，
空 Group 才回退到持久化 frame。Ungroup 只接受 first-class Group 及严格匹配的历史透明 Group，
普通 Container 不再可解除分组。

项目组件使用 `application/vnd.compose-ui.component+json`、`.component.json` 和独立
`Component Asset v1`，页面仍是 `ComposeDocument v6`。Base 保存单根文档，根可以是容器或任意 Entity；
Variant 保存直接父引用、稳定 ID 语义覆盖、applied lineage 与离线 resolved snapshot。同一链最多
八层，只允许同 Provider/scope。

### 主组件 / 变体 / 实例

产品用语固定为：**主组件**（库内本体，实心图标）、**变体**（相对父源的覆盖资源，空心+侧标）、
**实例**（页面上的引用，空心图标）。从组件库或资源浏览器拖入、以及复制场景中的实例，都只产生
新实例，不会新建变体文件。从实例「创建变体」会固化本层覆盖为新变体资源，并默认把当前实例改绑
到该变体。实例上的 Apply 写回其直接引用的主组件或变体（不是永远写 Base）。

实例内部层级在宿主编辑期可见：Scene Tree 惰性投影内部实体树，Stage 双击逐层下钻，两者选中态
与展开状态双向同步。内部节点使用 `实例ID/内部ID` 复合地址，只存在于编辑期表示层——持久化文档里
实例仍是单个 Entity。选中内部节点后 Inspector 的编辑与场景树的删除、移动都写入实例的
`instanceOverrides`：只有结构操作一个分区，复用 Variant 的稳定操作代数，因此 Apply 到父源无需
有损转换。实例子树是封闭编辑域，跨越实例边界的移动一律拒绝。

实例的最外层就是组件根：单选一个已有容器创建组件时直接复用它，不追加包装层。页面上的实例最外层
始终可 free 缩放（8 控点：4 角 + 4 边），便于组合排版，与组件根自身的 Resize 约束解耦；缩放结果
写入以根为目标的实例覆盖，宿主 LayoutItem 保持 Hug。实例还暴露根的布局、外观与裁剪。

创建组件可从 Stage、Scene Tree 或 Command Panel 进入，也可把普通 Scene Tree 行拖到可写资源目录。
资源写入成功后才用一个场景事务把选区替换成关联实例；Undo 不删除资源文件。Apply 只写直接父源，
Revert 只消费当前层覆盖。组件源保存后依赖实例自动同步：全部覆盖仍兼容时直接刷新，存在失效覆盖
时保留旧快照并逐条列出，由用户确认丢弃；离线时使用实例保存的快照。未配置
`ComposeComponentStore` 的宿主仍只显示 Registry Preset。

## Stage、Inspector 与 Preview

Stage Engine 通过 Component 查询决定系统能力：

- Move/Resize/Rotate 查询 `LayoutItem + Transform + Visibility + Lock + GeometryConstraints`。
- Render 查询 Snapshot 以及 `Renderer` 或 `Hierarchy`。
- Hierarchy、Clip、Appearance 由独立查询解析。Clip 保留旧版 `enabled` 开关并支持可选的
  `horizontal`/`vertical` 分轴 `visible | clip | scroll` 策略：Stage 仅显示不可交互的滚动提示，
  Preview 使用浏览器原生滚动，滚动位置不会进入文档或撤销历史。

Resize 模式支持 `free`、`preserve-aspect`、`horizontal`、`vertical`、`none`；手柄会与约束
同步变化。Pointer 移动期间只维护临时 Preview Transform，松手后最多提交一个正式事务。

Inspector 按 Registry 顺序聚合当前 Entity 的 Component 属性区。Definition 可用
`inspectorGroup: 'basic'` 把领域字段合并到“基础”，也可指定独立分组的默认展开状态。
内建基础区按“名称、位置/自身对齐、旋转、尺寸、外边距”紧凑组合 Transform 与 LayoutItem：
Absolute 的 X/Y 使用独立 Position 类型，Flow 显示独立自身对齐字段，旋转复用 Angle 类型；尺寸的
W/H 分别使用单一智能输入：数字表达 Fixed，聚焦后可选择或直接输入英文 `Fill`/`Hug`，
外边距可按 T/R/B/L 展开。Auto Layout 的内边距复用同一套单值/四边展开交互，并按其他布局字段
的上下结构显示 `padding` CSS 属性名；下方只读实时预览用三个模拟节点及主轴/交叉轴指示展示布局
结果，模拟节点使用低对比扁平样式。再次点击已选的非默认 Flex 选项会恢复显式 CSS 初始等价值，
默认项使用中性弱选中样式。没有 Layout 时，“布局”分组默认展开紧凑引导，也可通过标题栏加号
或正文按钮启用 Auto Layout。顶部加号菜单用产品术语扩展 Entity；锁定后只有 Lock
可编辑。Preview 使用与 Stage 相同的 LayoutSnapshot、Transform rotation、Appearance、Hierarchy、
Clip 和 Renderer 语义，但不包含编辑 chrome。

宿主 Renderer 可以在 definition 上声明 `measurement`。`createComposeRendererMeasurementAdapter()`
负责缓存、AbortController、资源/页面订阅、迟到结果丢弃和精确 Entity 失效；完成使用后必须
`dispose()`。Preview 默认自行管理 adapter，也可以注入宿主拥有的 Layout Runtime。

## 页面系统

页面文件是 `{ kind, pageSchemaVersion, document, setupScript }` 聚合，以 `.page.json` 后缀持久化；
`document` 是画布对 JSX/template 的可视化表达，`setupScript` 是零或一个稳定资源引用。首页仍由
资源根的 `app.json` 唯一表达。旧裸 v6 页面必须显式调用 `migrateLegacyComposePageFile()` 迁移。
`@compose-ui/pages` 提供无 React、无 DOM 的聚合 Store 与 Loader。

setup 是受信任的同 Realm、自包含 JavaScript ESM，不经过编译，也不是安全沙箱：

```js
export function setup(ctx) {
  const num = ctx.state(0)
  const onAdd = () => { num.value += 1 }
  const buttonLabel = ctx.computed(() => `Add ${num.value}`)
  ctx.effect(() => {
    const timer = setTimeout(() => { num.value += 100 }, 2_000)
    return () => clearTimeout(timer)
  })
  return { num, onAdd, buttonLabel }
}
```

State/Computed 通过 `.value` 工作；返回 Function 只能绑定声明为 event-handler 的 method Prop。
`Renderer.props` 仍是持久化的 authored JSON，React Renderer 收到的 runtime `props` 可以包含
运行值与 Function，序列化或发出编辑命令时必须使用 `authoredProps`。Renderer Definition 的
`propContracts` 是唯一可绑定边界：Renderer 以 `propCategories` 声明属性分类，各分类的第一层字段旁
可绑定单个返回成员；未分类字段进入“高级”，没有未分类内容时不显示该分组。解析以 authored Props
为基础，再逐字段应用有效绑定；字段失败回退同名 authored 值且永不改写 authored Props。Editor 将
method 包装为 no-op，Preview 才安全调用并把同步异常与 Promise rejection 报告到页面脚本作用域。

```tsx
const [activePage, setActivePage] = useState<ComposeEditorActivePage | null>(null)
// 工作区跟随活动页面：宿主拥有 controller，因此由宿主换 runtime。
const controller = useComposeEditorController({
  runtime: activePage?.runtime ?? rootRuntime,
  registry,
  scriptScope: activePage?.scriptScope,
})

<ComposeEditor
  assets={{ browser: { provider } }}
  controller={controller}
  pages={pagesConfig}
/>
```

`pages` 与 `runtime` 必须保持稳定引用：前者决定页面 Store 的派生，后者变化会被当作换文档
并重置选择与视口。资源面板据此提供页面创建、首页、JSON 与 setup 脚本关联操作，
双击页面文件以独立标签打开，每个页面拥有自己的事务运行时与撤销历史。

## 包边界

- Headless：`core`、`assets`、`pages`、`script-runtime`、`layout-engine`、`stage-engine`，不依赖 React/DOM。
- Shared UI/Protocol：`ui-context`、`components`、`component-registry`。
- Domain Widgets：`stage`、`scene-tree`、`asset-browser`、`history`、`property-panel`、
  `operation-log`、`command-panel`、`component-library`、`materials`。
- Entry：`editor`、`preview`。
- `app/` 与 `apps/storybook/` 只承担集成演示和公共 API 契约。

跨包导入只使用 `@compose-ui/*` 公共入口。React、ReactDOM 与 JSX runtime 保持 peer
dependency 和构建外置，避免宿主加载多份 React。

## 本地开发

```bash
bun install
bun run dev
```

默认示例地址为 `http://localhost:5173`。

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:e2e
```

涉及黄金图时使用独立的 `bun run test:e2e:update` 更新，再人工审阅 expected/actual/diff。

## 当前边界

页面聚合、Page Slot、setup 脚本、页面作用域 value/method Props 绑定已交付。首期只支持页面
作用域、每页一个自包含 JavaScript setup，不支持 TypeScript 编译、模块图、不可信代码隔离、
应用级状态、动态 Entity 树、列表/条件模板、双向绑定或 HMR 状态保留。

当前 Component Asset v1 不提供 Detach、跨 Provider Variant、自动更新、批量 Apply、任意实例内部
结构编辑或超过八层的继承/嵌套。Interaction、Animation、数据源和正式持久化仍需独立 OpenSpec。

## License

MIT
