# @compose-ui/component-registry

实例级 ECS 注册协议。Registry 不拥有文档、History 或模块级全局状态，统一注册 Renderer、
Component、Entity Preset 和 Capability。

```tsx
import { createComposeEntityRegistry } from '@compose-ui/component-registry'

const registry = createComposeEntityRegistry({
  renderers: [{
    type: 'metric',
    label: '指标卡',
    renderer: ({ props, mode }) => (
      <MetricCard
        mode={mode}
        title={String(props.title)}
        value={Number(props.value)}
      />
    ),
    propContracts: [{
      name: 'value',
      kind: 'value',
      label: '指标值',
      validate: (value) => typeof value === 'number' || '必须是 number',
    }],
    measurement: {
      async prepare({ signal }) {
        return loadMetricMetadata(signal)
      },
      measure({ prepared, width, height }) {
        return measureMetricCard(prepared, width, height)
      },
    },
  }],
  presets: [{
    id: 'metric',
    label: '指标卡',
    defaultName: '销售指标',
    createComponents: () => ({
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 280, min: 1, max: null },
        height: { mode: 'fixed', value: 140, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Appearance: { backgroundPaint: { kind: 'solid', color: '#172033' } },
      Renderer: { type: 'metric', props: { title: '销售额', value: 0 } },
    }),
  }],
})
```

`createSeed(presetId)` 会自动写入 `Composition`，记录 Preset 的基础 Component Keys，并为每次
调用返回隔离的数据副本。Palette 只消费 Preset；Renderer 负责 Stage/Preview 内容，Component
Definition 负责校验、排序和可选 Inspector。

Capability 是用户可添加的一组 Component。Registry 校验依赖无环、冲突关系和 Component Key
归属不重叠；添加能力会自动补齐依赖并规划为单个 `transaction.batch`。基础 Component 不可移除，
被其他能力依赖、仍含子项或 Registry 定义缺失的能力也不会被猜测删除。

Component Definition 可以通过 `inspectorHeaderActions` 声明 Inspector 分组标题栏状态或操作；
`ComposeRegistryComponentInspectorHeaderActions` 会透传与正文 Inspector 相同的实体、值、命令
派发和只读上下文。`inspectorGroup: 'basic'` 使领域 Inspector 合并进宿主基础分组；
Component 与 Renderer 的 `inspectorDefaultExpanded` 显式决定独立分组的初始展开状态。

`ComposeRegistryEntityRenderer`、`ComposeRegistryComponentInspector`、
`ComposeRegistryComponentInspectorHeaderActions` 和 `ComposeRegistryRendererInspector` 隔离
宿主异常。未知 Renderer 或 Component 显示可访问降级，Entity 仍可选择、移动和删除。

资源型 Preset 可通过 `assetDrop` 声明 MIME 接受规则和异步 seed factory。Registry 依赖
`core` 与轻量 `assets` 协议，React 保持 peer dependency；不依赖 editor、asset-browser 或
property-panel。

Renderer 文档中的 `Renderer.props` 是严格 JSON authored props；Renderer 实际收到的 `props` 是
绑定解析后的 runtime props，并单独收到 `authoredProps`。Definition 的完整 value/method
`propContracts` 是唯一可绑定边界；未知 authored Prop 继续保留但不会自动开放绑定。解析以 authored
Props 为基础并逐字段应用有效绑定；单字段失败只回退同名 authored 值。`inspectorPropNames` 只能
列出 value Contract，表示自定义 Inspector 会把这些字段的绑定入口内联到字面 editor；其余 Contract
由 Editor 显示 binding-only 行。Definition 使用 `propCategories` 声明 Props 分类，Contract 以
`category` 归属分类；Registry 校验分类唯一且引用有效。未分类 Contract 由 Editor 放入隐式「高级」，
自定义 Inspector 通过 `propCategory` 获知当前分类。method 在 Editor 为 no-op，在 Preview 安全调用。

Renderer 可声明同步 `measurement.measure`、可选异步 `prepare` 和外部 revision `subscribe`。
`createComposeRendererMeasurementAdapter()` 把 Registry、asset resolver 与 page loader 组合为 Core
measurement port：准备中、抛错和非法结果会变为可恢复诊断；引用变化会 Abort 旧任务并丢弃迟到
结果；`dispose()` 会取消全部准备、订阅和 listener。Measurement definition 可以使用隔离的内容
测量环境，但不得读取 Stage 或 Preview 的 Scene Entity DOM。
