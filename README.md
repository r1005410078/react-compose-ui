# React Compose UI

React Compose UI 是一组可嵌入 React 项目的低代码 UI 组件，面向需要在客户现场快速搭建
和调整定制化数据大屏的实施工程师与前端开发者。

它希望把重复的大屏页面开发工作转化为可视化操作，让使用者能够添加组件、调整配置并
实时查看最终效果，减少现场修改代码、重新构建和部署的次数。

> 当前版本处于基础能力验证阶段，提供版本化 JSON 文档、同步命令事务、组件注册表、
> DOM/SVG 无限 Stage、Frame/Rectangle/Text/Image/SVG 基础物料、编辑器 controller、场景树、
> 会话历史、Schema 属性面板、本地操作日志、Command 调试台、资源浏览/预览/画布拖入与
> Frame 文档预览，尚不是完整的低代码编辑器。

## 环境要求

- React 18.3 或 React 19
- ReactDOM 18.3 或 ReactDOM 19
- 使用 ESM 的前端构建环境

仓库本地开发使用 Bun 1.3.14。

## 安装

相关包发布到 npm 后，可以安装需要的组件：

```bash
bun add @compose-ui/core @compose-ui/assets @compose-ui/stage-engine @compose-ui/ui-context @compose-ui/components @compose-ui/command-panel @compose-ui/component-registry @compose-ui/stage @compose-ui/materials @compose-ui/editor @compose-ui/history @compose-ui/scene-tree @compose-ui/property-panel @compose-ui/operation-log @compose-ui/asset-browser @compose-ui/preview valibot
```

也可以使用 npm：

```bash
npm install @compose-ui/core @compose-ui/assets @compose-ui/stage-engine @compose-ui/ui-context @compose-ui/components @compose-ui/command-panel @compose-ui/component-registry @compose-ui/stage @compose-ui/materials @compose-ui/editor @compose-ui/history @compose-ui/scene-tree @compose-ui/property-panel @compose-ui/operation-log @compose-ui/asset-browser @compose-ui/preview valibot
```

React 和 ReactDOM 由宿主项目提供：

```bash
bun add react react-dom
```

仓库开发阶段请使用下方“运行仓库示例”的方式，不要假设 npm 中已经存在尚未发布的版本。

## 在 React 中使用

```tsx
import { createComposeComponentRegistry } from '@compose-ui/component-registry'
import { createTransactionRuntime } from '@compose-ui/core'
import { ComposeEditor, useComposeEditorController } from '@compose-ui/editor'
import { ComposePreview } from '@compose-ui/preview'
import '@compose-ui/editor/styles.css'

export function ComposePage() {
  const runtime = useMemo(() => createTransactionRuntime({ document }), [])
  const registry = useMemo(() => createComposeComponentRegistry(definitions), [])
  const controller = useComposeEditorController({ runtime, registry })

  return (
    <main>
      <ComposeEditor controller={controller} style={{ height: 720 }} />
      <ComposePreview document={runtime.document} registry={registry} />
    </main>
  )
}
```

`ComposeEditor` 使用 Dockview 提供固定的 IDE 式工作区：Scene Graph 与 Component Library
共享左侧 Edge Group，Stage 位于中央 Canvas 主组，Component Inspector 位于右侧 Edge Group，
Transaction Log、Command 与 Assets 共享底部 Edge Group。三个边缘区可以调整尺寸，并通过活动标签
折叠或展开。

宿主必须显式导入 `@compose-ui/editor/styles.css`，并为编辑器提供确定的非零高度。
`ComposeEditor` 接受标准的 HTML `section` 属性；替换工作区区域时使用语义化 `slots`，例如
`slots={{ stageToolbar: <StageTools />, inspector: <PropertyInspector /> }}`。默认 Scene Graph
由 `sceneTree` 配置，默认资源浏览器由 `assets.browser` 配置；`ComposePreview` 始终需要正式
`document` 和 `registry`，不再接受 children 容器模式。

Dockview 是 editor 包的内部实现，公共入口不会导出 Dockview API、面板对象或布局 JSON。
当前实例中的尺寸、折叠状态和活动标签会在挂载期间保留，但不会写入 localStorage、页面
文档或远端存储；重新挂载后恢复默认布局。

## 资源浏览器与共享 Tree

`@compose-ui/components` 提供无业务语义的受控虚拟 `ComposeTree<T>`：多选、范围选择、键盘/ARIA、
过滤祖先保留和可选 Pointer 拖排。`ComposeSceneTree` 与 `ComposeAssetBrowser` 组合这一个树内核，但场景
命令、资源 Provider 和持久化仍分别留在各自包中。

共享 Primitive/Pattern 采用包内 Shadcn 源码作为默认实现基础，并只公开 Compose 命名 API。例如可直接
使用 `ComposeButton`；它跟随 `ComposeUIProvider` 的 token，不注入全局 Preflight 或另一套主题：

```tsx
import { ComposeButton } from '@compose-ui/components'
import '@compose-ui/components/styles.css'

<ComposeButton>保存</ComposeButton>
```

轻量 `@compose-ui/assets` 定义 `ComposeAssetProvider`、稳定资源引用和运行时 resolver；
`@compose-ui/asset-browser` 连接任意资源事实来源，提供目录树、
文件夹缩略图网格，并在文件双击/Enter 后由 `ComposeAssetPreview` 提供 SVG/常见图片安全预览、二进制信息
和按需加载的 Monaco 脚本编辑。默认 `ComposeEditor` 会把这些显式打开的资源放进中央 Canvas Group 的可关闭
文档标签；单击文件不会读取内容或替换目录网格。写入使用
`expectedRevision` 乐观并发；资源操作不进入 ComposeDocument、History 或 Operation Log。

```tsx
import { createComposeAssetResolver } from '@compose-ui/assets'
import { ComposeAssetBrowser } from '@compose-ui/asset-browser'
import '@compose-ui/asset-browser/styles.css'

const assetResolver = createComposeAssetResolver(assetProvider)

<ComposeAssetBrowser
  provider={assetProvider}
  onCanvasDrag={handleCanvasDrag}
  style={{ height: 560 }}
/>
```

浏览器支持时，也可由用户手势调用 `openComposeFileSystemAssetProvider()` 打开本地可读写目录。目录
句柄只保留在当前组件实例，不会自动写入 IndexedDB。只有 Provider 提供 reference capability、
不可变 `assetKey` 和 `resolveAsset` 时，兼容 SVG/位图才可拖到 Stage。节点仅保存引用，资源
内容更新会刷新 renderer，但不会产生文档事务。

`ComposeEditor` 不直接拥有文档 `value`/`onChange`。推荐由宿主创建下方
`TransactionRuntime` 和 `ComposeComponentRegistry`，再使用 `useComposeEditorController` 组合默认
Palette、ComposeSceneTree、ComposeStage、History、Inspector 与 ComposeCommandPanel。显式 `slots`
可覆盖 controller 默认内容。

## 共享主题、国际化与设置

`@compose-ui/ui-context` 提供可嵌套的 `ComposeThemeProvider`、`ComposeI18nProvider` 和
`ComposeUIProvider`。Stage、Palette、ComposeSceneTree、History、ComposeCommandPanel、ComposePropertyPanel、
OperationLog 与基础材料 Inspector 会直接消费同一个 Context；宿主可按 dark/light 覆盖语义
token，也可用稳定 message ID 覆盖单条内建文案。registry label、Schema metadata、插槽内容和
业务组件不会被猜测翻译。

```tsx
import { ComposeUIProvider } from '@compose-ui/ui-context'

<ComposeUIProvider
  locale="en-US"
  theme="system"
  overrides={{ light: { accent: '#7c3aed' } }}
  messages={{ 'propertyPanel.search': 'Find a property' }}
>
  <ComposeEditor controller={controller} />
</ComposeUIProvider>
```

`ComposeEditor` 会根据实例 preferences 在根部组合一层 Provider，同时继承外层宿主的 token 和
message 覆盖。左下角齿轮打开仅覆盖当前 Editor 的模态设置中心：顶部全局搜索、左侧外观/语言/
键盘快捷方式分类、右侧即时生效内容。偏好仍由宿主选择是否受控和持久化，不进入文档事务。

## 文档与命令事务

`@compose-ui/core` 提供 React/DOM 无关的 `ComposeDocument`、文档校验、可逆 Patch、内置命令和
`TransactionRuntime`。成功命令形成唯一正式事务历史；noop 与 rejected 只发布命令事件，
不会进入 History。`reset` 用于载入文档并创建新的历史基线。

```tsx
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createTransactionRuntime,
  type ComposeDocument,
} from '@compose-ui/core'

const document: ComposeDocument = {
  schemaVersion: 3,
  canvas: createDefaultCanvasSettings(),
  output: createDefaultOutputSettings(),
  rootIds: ['page'],
  nodes: {
    page: {
      id: 'page',
      kind: 'frame',
      name: 'Page',
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
      childIds: [],
      clipContent: true,
    },
  },
}

const runtime = createTransactionRuntime({ document })
runtime.dispatch({
  id: crypto.randomUUID(),
  type: 'node.create',
  payload: {
    node: {
      id: 'mobile',
      kind: 'frame',
      name: 'Mobile',
      visible: true,
      locked: false,
      transform: { x: 2100, y: 0, width: 390, height: 844, rotation: 0 },
      childIds: [],
      clipContent: true,
    },
    parentId: null,
  },
  meta: { label: '创建 Mobile Frame', source: 'toolbar', targetIds: ['mobile'] },
})
```

`@compose-ui/command-panel` 订阅同一个 runtime，显示 committed、noop、rejected、事务来源和
可逆 Patch，并只接受宿主声明的结构化 JSON 字段预设：

```tsx
import { ComposeCommandPanel } from '@compose-ui/command-panel'
import '@compose-ui/command-panel/styles.css'

<ComposeCommandPanel runtime={runtime} presets={commandPresets} />
```

文档拓扑、内置命令与运行时完整说明见
[`@compose-ui/core` README](./packages/core/README.md)，调试台说明见
[`@compose-ui/command-panel` README](./packages/command-panel/README.md)。

## 组件注册、无限 Stage 与 Preview

`@compose-ui/component-registry` 由宿主按稳定 `type` 注册默认 JSON props/style、默认尺寸、React
renderer 和可选 Inspector。`@compose-ui/stage` 使用 DOM 渲染 Frame 与业务组件，以屏幕坐标
SVG/DOM Overlay 绘制正负坐标标尺、主/细网格、世界原点轴、选区尺寸、手柄、全局辅助线和
可访问滚动条；组件内部仍可使用 Canvas，例如 ECharts。坐标换算、SceneIndex、吸附、内部
手势、Palette 拖入和 group/reparent 空间规划统一由无 React/DOM 的
`@compose-ui/stage-engine` 承载。

```tsx
import { createComposeComponentRegistry } from '@compose-ui/component-registry'
import { createTransactionRuntime } from '@compose-ui/core'
import type { ComposeDocument } from '@compose-ui/core'
import { ComposeEditor, useComposeEditorController } from '@compose-ui/editor'
import { useState } from 'react'

const registry = createComposeComponentRegistry([{
  type: 'text',
  label: '文本',
  defaultSize: { width: 240, height: 72 },
  createDefaultProps: () => ({ text: '大屏标题' }),
  renderer: ({ props }) => <strong>{String(props.text)}</strong>,
}])

function Workspace({ document }: { document: ComposeDocument }) {
  const [runtime] = useState(() => createTransactionRuntime({ document }))
  const controller = useComposeEditorController({ runtime, registry })

  return <ComposeEditor controller={controller} style={{ height: 720 }} />
}
```

需要开箱即用的 Frame、Rectangle、Text、Image 与 SVG 时，可使用独立 materials factory，并继续在末尾追加
宿主 definitions：

```tsx
import { createComposeBasicMaterials } from '@compose-ui/materials'
import '@compose-ui/materials/styles.css'

const materials = createComposeBasicMaterials({ extensions: [echartsDefinition] })
const controller = useComposeEditorController({
  runtime,
  registry: materials.registry,
  framePresets: materials.framePresets,
  containerInspector: materials.ContainerInspector,
})
```

基础物料把背景、边框、圆角、透明度和结构化 shadow 统一写入 `node.style`。Stage 与 Preview
使用同一 resolved style；Rectangle 仍兼容读取无 style 旧文档的视觉 props。Image/SVG 默认从
Component Library 隐藏，通过资源面板拖入创建；两者使用同一个 runtime resolver，SVG 必须净化
后才内联并支持填充/描边覆盖。

网格步长/偏移/主线间隔、节点/辅助线吸附开关和全局世界辅助线保存在
`ComposeDocument.canvas`，会进入事务 History 与 Operation Log。选择、工具、场景树展开项、
viewport 和动态滚动范围是 controller 会话状态，不进入文档事务。Palette 拖入、
ComposeSceneTree 操作、Inspector 修改、Stage 手势和结构化 Command 表单全部派发到同一 runtime。
成功事务可通过 controller 的 `onTransaction` 单点映射到 Operation Log；noop、rejected 与 reset
不会被当作成功编辑记录。

文档 output 默认是世界 `(0,0)` 起始的 `1280×720` 透明区域。Stage 以固定 1 屏幕像素的
主题中性边框标识它，选中 Canvas 时四边统一使用编辑器强调色；Godot 风格的红色 X 轴与
绿色 Y 轴保留独立坐标语义，世界原点在连续坐标轴之上显示精确复刻 `EditorPosition` 的
16×16 双填充前景标记。
点击边界会打开 Canvas Inspector，可直接选择 1280×720、1366×768、1440×900、
1920×1080、2560×1440 或 3840×2160，也可编辑自定义宽高和背景。Canvas 只是检查目标，
不会出现在 ComposeSceneTree、`nodes` 或节点选择中。

`ComposePreview` 接收 `document`、`registry`、可选 `assetResolver` 和 `target`。默认按文档固定输出边界渲染
完整文档，也可输出任意根级或嵌套 Frame；两种模式都不包含 Stage 的 SVG 编辑覆盖层：

```tsx
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

完整说明见 [`assets`](./packages/assets/README.md)、
[`component-registry`](./packages/component-registry/README.md)、
[`stage-engine`](./packages/stage-engine/README.md)、[`stage`](./packages/stage/README.md)、
[`materials`](./packages/materials/README.md)、
[`editor`](./packages/editor/README.md) 与
[`preview`](./packages/preview/README.md)。

## 独立使用历史

`@compose-ui/history` 提供会话级不可变快照历史。默认保留 100 个动作，相同 `mergeKey` 的连续
输入会在 750ms 窗口内合并；在历史中间提交会裁剪后续重做分支。

```tsx
import { ComposeHistoryPanel, useComposeHistory, useComposeHistoryShortcuts } from '@compose-ui/history'
import '@compose-ui/history/styles.css'

const history = useComposeHistory(initialDocument)
const onKeyDownCapture = useComposeHistoryShortcuts(history)

<section onKeyDownCapture={onKeyDownCapture}>
  <ComposeHistoryPanel controller={history} />
</section>
```

快捷键支持 `Cmd/Ctrl+Z`、`Cmd/Ctrl+Shift+Z` 和 `Ctrl+Y`。历史不跨刷新持久化，也不会深拷贝
宿主值；每次 `commit` 都必须产生不可变快照。完整说明见
[`@compose-ui/history` README](./packages/history/README.md)。

编辑器左侧活动栏底部提供设置中心，支持 Dark/Light/System、简体中文/English，以及
Space 临时平移、工具、适配、缩放、吸附、编辑和历史动作的快捷键重绑。偏好仅属于当前
Editor 实例；宿主可用受控 `preferences` 自行持久化，编辑器不会写 localStorage 或文档历史。

## 独立使用属性面板

`@compose-ui/property-panel` 从同步 Valibot Schema 自动生成受控属性 UI，支持基础类型、对象、
数组、tuple/rest、record、union、variant 及 optional/nullable/nullish 包装器。候选完整值只有在
通过 Schema 校验后才会交给宿主：

```tsx
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import '@compose-ui/property-panel/styles.css'
import * as v from 'valibot'

const schema = v.object({
  appearance: v.pipe(
    v.object({
      opacity: v.pipe(v.number(), v.minValue(0), v.maxValue(1), v.title('不透明度')),
    }),
    v.title('Appearance'),
  ),
})

<ComposePropertyPanel
  schema={schema}
  value={value}
  defaultValue={{ appearance: { opacity: 1 } }}
  onValueChange={(nextValue, change) => {
    setValue(nextValue)
    console.log(change.path, change.reason, change.output)
  }}
/>
```

面板提供搜索、全部/已修改/有错误筛选、默认值重置和两条可通过 Pointer 或键盘调整的三列
分隔线。自定义语义类型通过实例级 renderer registry 扩展；Schema metadata 只保存稳定的
editor ID，不保存 React 组件。大型 renderer 可以采用标题行加全宽内容区，并由字段 metadata
覆盖 renderer 默认布局。可选的受控 bindings 能把已有页面/全局变量单向绑定到 Schema metadata
显式启用的内置字段，或 renderer 明确声明的稳定子目标；字面值与绑定关系分开保存，Canvas 可复用
`resolvePropertyBindings` 计算 effective properties。完整 API、metadata 和主题变量见
[`@compose-ui/property-panel` README](./packages/property-panel/README.md)。

## 独立使用场景树

```tsx
import { ComposeSceneTree, useComposeSceneTreeCommands } from '@compose-ui/scene-tree'
import '@compose-ui/scene-tree/styles.css'

<ComposeSceneTree
  nodes={nodes}
  selectedIds={selectedIds}
  expandedIds={expandedIds}
  onSelectionChange={(ids) => setSelectedIds([...ids])}
  onExpandedChange={(ids) => setExpandedIds([...ids])}
  onOperation={handleOperation}
/>
```

`useComposeSceneTreeCommands({ nodes, selectedIds, onOperation })` 可供外部工具栏和 `ComposeSceneTree` 的
`commands` 属性共享新增、删除、复制、剪切和树内粘贴状态。复制粘贴发出 `duplicate` 意图，
宿主负责生成新 ID 和克隆业务数据；剪切粘贴发出 `move`。该剪贴板不使用系统剪贴板且不持久化。

外部工具栏可以直接通过 controller 请求新增节点：

```tsx
const commands = useComposeSceneTreeCommands({ nodes, selectedIds, onOperation })

<button
  disabled={!commands.isEnabled('create-suggested')}
  onClick={() => commands.execute('create-suggested')}
>
  新增节点
</button>

<ComposeSceneTree {...treeProps} commands={commands} />
```

`create-child`、`create-sibling` 和 `create-root` 可以显式指定子级、兄弟或根级位置；
`create-suggested` 会根据最近选择自动决定位置。新增只发出 `create` 操作意图，宿主必须处理
其中的 `parentId` 和 `index`、生成稳定 ID，并更新受控 `nodes`。完整示例和 `targetId` 规则见
[`@compose-ui/scene-tree` README](./packages/scene-tree/README.md#从外部新增节点)。

场景树通过 `@tanstack/react-virtual` 支持完全展开的 5000 个节点，检索支持大小写敏感、
Unicode 全词和正则表达式。组件仅发出操作意图，不拥有文档 Schema、持久化或撤销状态。
拖拽期间节点保持静止，蓝色横线显示最终插入位置；Shift 选择的多个节点可以按原顺序
一起移动，横向移动指针可以调整目标层级，松手后才发出 `move` 操作意图。
节点聚焦后，macOS 和 Linux 使用 Enter 开始重命名，Windows 使用 F2；双击不会进入
重命名状态。

## 记录本地操作日志

`@compose-ui/operation-log` 记录宿主已经成功应用的组件、场景、属性和绑定变更，并默认按
`scopeId` 保存到 IndexedDB。它可以直接放入编辑器已有的 `slots.transactionLog`：

```tsx
import {
  ComposeOperationLogPanel,
  ComposeOperationLogProvider,
  useComposeOperationLog,
} from '@compose-ui/operation-log'
import '@compose-ui/operation-log/styles.css'

function Workspace() {
  const log = useComposeOperationLog()
  return (
    <ComposeEditor slots={{ transactionLog: <ComposeOperationLogPanel /> }}>
      <button onClick={() => {
        applySuccessfulChange()
        void log.record({
          action: 'component.create',
          category: 'component',
          summary: '新增组件',
        })
      }}>
        新增
      </button>
    </ComposeEditor>
  )
}

<ComposeOperationLogProvider scopeId="workspace-42">
  <Workspace />
</ComposeOperationLogProvider>
```

日志按 scope 隔离，默认保留最新 1000 条；IndexedDB 不可用时自动降级到当前会话内存存储。
连续属性输入只有在宿主提供相同 `coalesceKey` 时才会在 800ms 内合并，reset、绑定和结构操作
保持独立。选择、展开、搜索、resize、非法属性草稿和变量值刷新不应调用 recorder。完整 API 与
快照格式见 [`@compose-ui/operation-log` README](./packages/operation-log/README.md)。

## 运行仓库示例

安装依赖：

```bash
bun install --frozen-lockfile
```

启动开发环境：

```bash
bun run dev
```

终端会显示 Vite 示例应用地址。根路径直接打开由统一 controller 驱动的完整 Stage 编排示例，
不再保留旧手写 Canvas 或事务专用入口：

1. 点击“创建 Frame”，或把 Component 直接添加到无限 Stage 的隐式 Canvas 根。
2. 打开 Component Library，把 Rectangle、Text 或 ECharts 拖入根部或任意嵌套 Frame。
3. 在 Stage 或 Scene Graph 中选择、移动、多选和分组节点，并通过右侧 Inspector 修改属性；
   点击透明输出边界可在 Canvas Inspector 中选择常见 PC 尺寸或编辑自定义输出。
4. 使用工具栏调整网格/智能吸附，或从标尺拖出全局辅助线；用滚动条在动态世界范围中导航。
5. 使用撤销/重做或 History 查看同一事务文档的变化。
6. 在 Command 调试台查看 committed、noop、rejected 及可逆 patches；Operation Log 只记录成功
   事务与历史导航。
7. 点击“打开预览”，在完整文档输出与选中 Frame 输出之间切换；canvas 编辑元数据不会进入预览。

该完整示例用于验证各包通过公开协议协同工作，不代表其内部 fixture 是稳定公共 API。

## 查看可视化 E2E 测试

打开 Playwright 测试界面：

```bash
bun run test:e2e:ui
```

在测试面板中选择：

```text
使用完整示例完成 Stage 纵向流程
```

可以查看“创建 Frame、拖入组件、多选分组、修改属性、撤销重做、查看命令与日志、预览
Frame”的每一步浏览器操作和 DOM
快照。

无界面运行全部 E2E：

```bash
bun run test:e2e
```

## 开发检查

```bash
# ESLint
bun run lint

# TypeScript
bun run typecheck

# Vitest
bun run test

# 构建示例应用和所有包
bun run build

# 检查 npm 包内容
bun run pack:dry-run
```

提交改动前建议依次运行：

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:e2e
```

## 当前限制

当前版本还没有正式提供：

- 页面文档 Schema 和版本迁移
- 组件物料注册
- 画布节点拖拽、缩放、对齐和图层编辑
- 正式数据源协议、表达式和变量管理（属性面板只接受宿主提供的只读变量快照）
- 基于正式 Transaction/inverse 协议的持久化、协作历史，以及跨页面或系统剪贴板复制粘贴
- 服务端审计同步、防篡改、日志导出和跨标签页实时同步（当前操作日志仅保存在本地）
- 页面保存、加载和生产发布协议
- 工作区布局持久化、自定义面板注册和浮动窗口

这些接口会在后续规范确定后逐步加入；请不要依赖示例应用内部的临时状态结构。
