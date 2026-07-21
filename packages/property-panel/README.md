# @compose-ui/property-panel

由同步 Valibot Schema 生成受控 React 属性编辑 UI。包本身不拥有页面文档、撤销历史或持久化，
可以单独嵌入任意 React 18.3/19 宿主，也可以通过 `ComposeEditor` 的 `inspectorPanel` 插槽使用。

## 安装与样式

```bash
bun add @compose-ui/property-panel valibot
```

React、ReactDOM 和 Valibot 是 peer dependencies。宿主需要显式加载样式：

```tsx
import '@compose-ui/property-panel/styles.css'
```

## Schema 驱动的受控面板

```tsx
import { PropertyPanel } from '@compose-ui/property-panel'
import { useState } from 'react'
import * as v from 'valibot'

const schema = v.object({
  transform: v.pipe(
    v.object({
      x: v.pipe(v.number(), v.title('位置 X')),
      y: v.pipe(v.number(), v.title('位置 Y')),
    }),
    v.title('Transform'),
  ),
  opacity: v.pipe(
    v.number(),
    v.minValue(0),
    v.maxValue(1),
    v.title('不透明度'),
    v.metadata({ propertyPanel: { section: 'Appearance', order: 10 } }),
  ),
})

const defaults = { transform: { x: 0, y: 0 }, opacity: 1 }

function Inspector() {
  const [value, setValue] = useState(defaults)
  return (
    <PropertyPanel
      schema={schema}
      value={value}
      defaultValue={defaults}
      onValueChange={(nextValue, change) => {
        setValue(nextValue)
        console.log(change.path, change.reason, change.output)
      }}
    />
  )
}
```

内置 UI 覆盖 string、number、bigint、boolean、date、literal、picklist、enum、对象、数组、
tuple/rest、record、union 和 variant，并识别 optional、nullable、nullish 包装器。候选完整值通过
Schema 校验后才会回调；无效文本或数字保留为字段本地草稿。

## 展示 metadata

使用 `v.title` 和 `v.description` 提供名称与说明。其余展示配置放在 metadata 的
`propertyPanel` 命名空间中：

```ts
v.metadata({
  propertyPanel: {
    editor: 'color',
    layout: 'full-width',
    section: 'Appearance',
    order: 20,
    hidden: false,
    readOnly: false,
    advanced: false,
    unit: 'px',
    placeholder: '请输入',
    optionLabels: { start: '起点', end: '终点' },
    collapsed: true,
    binding: { enabled: true, semanticScope: 'opacity' },
  },
})
```

metadata 只保存稳定数据，不能放 React 组件或函数。

## 自定义类型和 renderer

自定义类型由 Schema 声明，UI 由每个面板实例的 registry 提供。所有 `commit` 仍走完整 Schema
校验：

```tsx
const chartSchema = v.object({
  option: v.pipe(
    v.custom<ChartOption>(isChartOption),
    v.title('图表配置'),
    v.metadata({ propertyPanel: { editor: 'chart' } }),
  ),
})

<PropertyPanel
  schema={chartSchema}
  value={value}
  renderers={[{
    id: 'chart',
    component: ChartOptionEditor,
    layout: 'full-width',
    createDefault: () => createDefaultChartOption(),
  }]}
  onValueChange={setValue}
/>
```

自定义 renderer 默认使用 `inline` 三列布局。图表、曲线、渐变等大型编辑器可以在 registry 中
声明 `layout: 'full-width'`：面板继续统一渲染字段标题和 reset/存在性操作，renderer 在下一行
跨越三列。具体字段也可以通过 `propertyPanel.layout` 覆盖 renderer 默认值；优先级为字段 metadata、
renderer 默认值、最后回退到 `inline`。该布局配置只影响已经匹配的自定义 renderer。

仓库示例在 `app/src/App.tsx` 中使用同一机制实现 ECharts `EChartOption` 自定义类型、结构化属性
编辑器和真实 Canvas 联动；ECharts 不属于本包的依赖或公共类型。

## 变量绑定

绑定关系与 Valibot 字面 input 分开受控。变量变化只更新 effective value，不会改写字面值或调用
`onValueChange`；宿主可以用同一个纯函数为 Canvas 计算实际属性：

```tsx
import { PropertyPanel, resolvePropertyBindings } from '@compose-ui/property-panel'

const variables = [
  { id: 'page.opacity', label: '页面透明度', scope: 'page', value: 0.65 },
] as const

const [bindings, setBindings] = useState([])

<PropertyPanel
  schema={schema}
  value={literalValue}
  binding={{
    value: bindings,
    variables,
    onChange: (next) => setBindings(next),
    canBind: (target, variable) => target.address.path[0] !== 'locked',
  }}
  onValueChange={setLiteralValue}
/>

const effective = resolvePropertyBindings({
  schema,
  value: literalValue,
  bindings,
  variables,
  renderers,
})
```

内置可编辑叶子使用固定 target ID `value`。变量选择器会按目标 Schema、`semanticScope` 和
`canBind` 过滤候选，再按页面/全局作用域分组；变量缺失或失效时只回退该目标的字面值，并在
`issues` 中报告。已绑定输入保持可聚焦和只读；解绑继续使用原字面值，reset 同时删除绑定并恢复
`defaultValue`。数组移动/删除、record 改键/删除和 union 切换由面板同步维护绑定地址。

复合 renderer 用稳定 descriptor 暴露多个逻辑输入，并在 UI 中把统一 trigger 放到对应控件尾部：

```tsx
const vectorRenderer = {
  id: 'vector2',
  component: VectorEditor,
  bindingTargets: () => [{
    id: 'x',
    label: 'X',
    schema: v.number(),
    getValue: (value) => value.x,
    setValue: (value, x) => ({ ...value, x }),
  }],
}

function VectorEditor({ value, commit, binding }) {
  const x = binding?.getTarget('x')
  return <label>
    <input
      readOnly={Boolean(x?.binding)}
      value={x?.effectiveValue ?? value.x}
      onChange={(event) => commit({ ...value, x: Number(event.target.value) })}
    />
    {binding?.renderTrigger('x')}
  </label>
}
```

ECharts 等依赖仍由宿主 renderer 持有；本包只处理 target 描述、选择器、受控 bindings 和解析。

## 面板交互和主题

- 搜索匹配 title、key、完整路径和 description。
- 筛选支持全部、相对 `defaultValue` 已修改、以及有 Schema issue 的属性。
- 设置菜单可以显示高级属性、字段说明，并恢复列宽。
- 两条可聚焦分隔线分别调整属性名列和操作列；默认宽度为 160px/36px，方向键移动 8px，
  Shift 加方向键移动 24px。操作列限制在 32–96px、最多三槽；空间不足时使用溢出菜单，行右键
  菜单始终提供全部操作。常规编辑控件在最大 234px 的右对齐轨道中显示，窄面板会自动收缩。
- 嵌套结构只缩进标题、标签和引导线，编辑列边界保持全局对齐；深层缩进会自动封顶，避免属性名
  被层级空白挤压。
- 分组和字段的重置只在 `defaultValue` 能通过完整 Schema 时提供。

可在 `.property-panel` 或其祖先范围内覆盖主题变量：

```css
.my-inspector .property-panel {
  --pp-bg: #12151a;
  --pp-bg-raised: #1c222a;
  --pp-bg-input: #0a0d10;
  --pp-border: #39414c;
  --pp-border-soft: #2b3139;
  --pp-text: #e2e8f0;
  --pp-text-muted: #94a3b8;
  --pp-accent: #60a5fa;
}
```

首版只支持同步 Valibot Schema；异步 Schema 会显示可访问的不支持提示并停止渲染字段。
