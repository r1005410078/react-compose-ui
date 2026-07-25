# @compose-ui/component-registry

宿主 React 组件的实例级注册协议。注册表不拥有文档或模块级全局状态。

```tsx
import { createComponentRegistry } from '@compose-ui/component-registry'

const registry = createComponentRegistry([{
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
`createSeed(type)` 每次返回独立的 props/style 副本和新节点名称。`RegistryComponent` 与 `RegistryInspector` 隔离
宿主 renderer 异常；未知组件显示可访问占位，文档节点仍可在 Stage 中选择、移动和删除。

本包依赖 core，并将 React 保持为 peer dependency；不依赖 editor 或 property-panel。
