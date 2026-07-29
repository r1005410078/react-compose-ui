# React Compose UI

React Compose UI 是一组可嵌入 React 项目的低代码 UI 组件，面向需要在客户现场快速搭建和
调整定制化数据大屏的实施工程师与前端开发者。

项目把重复的页面编码工作逐步转化为可视化编排、属性配置、预览和保存发布流程。当前仍处于
基础能力验证阶段：已经具备 ECS 化 JSON 文档、同步命令事务、Entity Registry、无限 Stage、
基础物料、聚合 Inspector、Scene Tree、History、Command/Operation Log、资源浏览和只读 Preview；
页面、交互、动画、变体、数据绑定与持久化协议尚未实现。

## 环境与安装

- React 18.3 或 React 19
- ReactDOM 18.3 或 ReactDOM 19
- ESM 前端构建环境
- 仓库开发使用 Bun 1.3.14

```bash
bun add @compose-ui/core @compose-ui/assets @compose-ui/stage-engine \
  @compose-ui/ui-context @compose-ui/components @compose-ui/component-registry \
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
  schemaVersion: 4,
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

## ComposeDocument v4

文档只保存严格 JSON：

```ts
interface ComposeDocument {
  readonly schemaVersion: 4
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
```

Component Key 强制 PascalCase，字段保持 camelCase。每个场景 Entity 必须拥有
`Composition + Transform + Visibility + Lock`，并至少拥有 `Renderer` 或 `Hierarchy`。
`Renderer + Hierarchy` 可以同时存在，因此“可渲染容器”不需要继承或特殊节点类型。

`Hierarchy.childIds` 是唯一父子事实来源，`rootIds` 保存顶层顺序。`Composition` 记录 Preset
基础项和已附加 Capability，使能力增删可以可靠保护基础数据。未知合法 Component 会被保留并
降级展示。v3 文档会被拒绝；没有迁移器、兼容别名或双运行路径。

## Registry、Preset 与能力

`ComposeEntityRegistry` 统一注册四类定义：

- Renderer：Stage/Preview 内容和可选内容 Inspector。
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

`@compose-ui/materials` 提供 Container、Rectangle、Text、Image、SVG Presets。Container 是
`Hierarchy + Clip` 的基础组合；普通物料是 `Appearance + Renderer`，也可以通过“容器”能力
获得子项。“几何限制”能力添加 `TransformConstraints`。

## Stage、Inspector 与 Preview

Stage Engine 通过 Component 查询决定系统能力：

- Move/Resize/Rotate 查询 `Transform + Visibility + Lock + TransformConstraints`。
- Render 查询 `Transform` 以及 `Renderer` 或 `Hierarchy`。
- Hierarchy、Clip、Appearance 由独立查询解析。

Resize 模式支持 `free`、`preserve-aspect`、`horizontal`、`vertical`、`none`；手柄会与约束
同步变化。Pointer 移动期间只维护临时 Preview Transform，松手后最多提交一个正式事务。

Inspector 按 Registry 顺序聚合当前 Entity 的 Component 属性区。顶部“添加能力”让用户以
产品术语扩展 Entity；锁定后只有 Lock 可编辑。Preview 使用与 Stage 相同的 Transform、
Appearance、Hierarchy、Clip 和 Renderer 语义，但不包含编辑 chrome。

## 包边界

- Headless：`core`、`assets`、`stage-engine`，不依赖 React/DOM。
- Shared UI/Protocol：`ui-context`、`components`、`component-registry`。
- Domain Widgets：`stage`、`scene-tree`、`asset-browser`、`history`、`property-panel`、
  `operation-log`、`command-panel`、`materials`。
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

本轮只完成单文档内 Entity/Component 组合重构。页面系统、复用 Instance、Interaction、
Animation、结构变体、数据源和正式持久化仍需独立 OpenSpec。未来页面可以持有一个
`ComposeDocument v4`，无需再次改变节点能力模型。

## License

MIT
