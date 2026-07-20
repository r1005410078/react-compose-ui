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
    section: 'Appearance',
    order: 20,
    hidden: false,
    readOnly: false,
    advanced: false,
    unit: 'px',
    placeholder: '请输入',
    optionLabels: { start: '起点', end: '终点' },
    collapsed: true,
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
    createDefault: () => createDefaultChartOption(),
  }]}
  onValueChange={setValue}
/>
```

仓库示例在 `app/src/App.tsx` 中使用同一机制实现 ECharts `EChartOption` 自定义类型、结构化属性
编辑器和真实 Canvas 联动；ECharts 不属于本包的依赖或公共类型。

## 面板交互和主题

- 搜索匹配 title、key、完整路径和 description。
- 筛选支持全部、相对 `defaultValue` 已修改、以及有 Schema issue 的属性。
- 设置菜单可以显示高级属性、字段说明，并恢复列宽。
- 两条可聚焦分隔线分别调整属性名列和操作列；方向键移动 8px，Shift 加方向键移动 24px。
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
