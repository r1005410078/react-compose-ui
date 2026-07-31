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
派发和只读上下文。

`ComposeRegistryEntityRenderer`、`ComposeRegistryComponentInspector`、
`ComposeRegistryComponentInspectorHeaderActions` 和 `ComposeRegistryRendererInspector` 隔离
宿主异常。未知 Renderer 或 Component 显示可访问降级，Entity 仍可选择、移动和删除。

资源型 Preset 可通过 `assetDrop` 声明 MIME 接受规则和异步 seed factory。Registry 依赖
`core` 与轻量 `assets` 协议，React 保持 peer dependency；不依赖 editor、asset-browser 或
property-panel。

Renderer 可声明同步 `measurement.measure`、可选异步 `prepare` 和外部 revision `subscribe`。
`createComposeRendererMeasurementAdapter()` 把 Registry、asset resolver 与 page loader 组合为 Core
measurement port：准备中、抛错和非法结果会变为可恢复诊断；引用变化会 Abort 旧任务并丢弃迟到
结果；`dispose()` 会取消全部准备、订阅和 listener。Measurement definition 可以使用隔离的内容
测量环境，但不得读取 Stage 或 Preview 的 Scene Entity DOM。
