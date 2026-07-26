# @compose-ui/component-registry

宿主 React 组件的实例级注册协议。注册表不拥有文档或模块级全局状态。

```tsx
import { createComposeComponentRegistry } from '@compose-ui/component-registry'

const registry = createComposeComponentRegistry([{
  type: 'metric',
  label: '指标卡',
  defaultName: '销售指标',
  icon: <MetricIcon />,
  defaultSize: { width: 280, height: 140 },
  createDefaultProps: () => ({ title: '销售额', value: 0 }),
  createDefaultStyle: () => ({ backgroundColor: '#172033', borderRadius: 12 }),
  renderer: ({ props, mode }) => (
    <MetricCard mode={mode} title={String(props.title)} value={Number(props.value)} />
  ),
  inspector: ({ node, dispatch }) => (
    <MetricInspector node={node} dispatch={dispatch} />
  ),
}])
```

`type` 在实例内必须唯一且非空，默认尺寸必须为有限正数，默认 props 必须是严格 JSON 对象。
`createSeed(type)` 每次返回独立的 props/style 副本和新节点名称。`ComposeRegistryComponent` 与 `ComposeRegistryInspector` 隔离
宿主 renderer 异常；未知组件显示可访问占位，文档节点仍可在 Stage 中选择、移动和删除。

资源型 definition 可设置 `paletteHidden: true` 隐藏普通 Component Library 入口，并通过
`assetDrop` 声明 MIME 接受规则和异步 seed factory。`createAssetSeed()` 按注册顺序选择第一个
接受资源的 definition，返回结构化成功、不支持或 factory 错误。renderer 通过
`ComposeComponentRendererProps.assetResolver` 读取最新资源内容，引用本身保持为普通 JSON props。

本包依赖 core 与轻量 assets 协议，并将 React 保持为 peer dependency；不依赖 editor、
asset-browser 或 property-panel。
