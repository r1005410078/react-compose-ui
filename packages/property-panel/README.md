# @compose-ui/property-panel

由同步 Valibot Schema 生成受控 React 属性编辑 UI。包本身不拥有页面文档、撤销历史或持久化，
可以单独嵌入任意 React 18.3/19 宿主，也可以通过 `ComposeEditor` 的 `slots.inspector` 使用。

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
import { ComposePropertyPanel } from '@compose-ui/property-panel'
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
    <ComposePropertyPanel
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

## 单面板、多 Schema 分组

需要把 ECS Component 或其他独立数据源放进同一个 Inspector 时，使用 Root 与 Section
共享一套搜索、筛选、显示设置和列宽；每个 `ComposePropertyPanel` 仍单独校验和提交：

```tsx
import {
  ComposePropertyPanel,
  ComposePropertyPanelRoot,
  ComposePropertyPanelSection,
} from '@compose-ui/property-panel'

<ComposePropertyPanelRoot aria-label="Entity 属性">
  <ComposePropertyPanelSection
    actions={<button type="button" onClick={resetTransform}>重置变换</button>}
    title="变换"
  >
    <ComposePropertyPanel schema={transformSchema} value={transform} onValueChange={setTransform} />
  </ComposePropertyPanelSection>
  <ComposePropertyPanelSection title="外观">
    <ComposePropertyPanel schema={appearanceSchema} value={appearance} onValueChange={setAppearance} />
  </ComposePropertyPanelSection>
</ComposePropertyPanelRoot>
```

Section 默认展开并可折叠；可选 `actions` 会显示在同一标题栏右侧，点击其中的操作不会折叠分组。
搜索会匹配分组名、字段名、路径与说明，只临时展开命中组；清空后恢复用户原来的折叠状态。Root
外的独立 `ComposePropertyPanel` 行为不变。Registry Inspector 放在 Section 内时无需修改现有实现；
其中的 Property Panel 会自动进入嵌入模式。同一 Section 可嵌入多个面板，搜索可见性按实例
聚合：任一嵌入面板命中即保留并展开整个 Section，实例卸载时会注销自己的可见性记录。

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

没有 JSON 字面编辑器的事件 Prop 可使用 `ComposePropertyPanelBindingTargetRow`。它是 binding-only
受控行，按 `value | method` 过滤变量并只返回变量 ID；文档事务、Bindings 与脚本作用域仍由宿主拥有。

## 内建语义类型

所有实例默认具备以下稳定 editor ID：`vector2`、`size`、`angle`、`opacity`、
`corner-radius`、`stroke-width`、`visibility`、`color`、`paint`、`alignment`、`map`、`node`。可从包入口导入
`COMPOSE_PROPERTY_PANEL_BASE_EDITOR_IDS` 获取同一不可变列表；实例 `renderers` 使用相同 ID 时，
宿主 renderer 优先，其他内建 editor 仍继续可用。

`node` 用于指向宿主节点的引用属性：它呈现可筛选的候选列表、清空入口与拖放目标，是面板中唯一的
拖放目标。候选来源、拖拽媒体类型、载荷解析与标签解析全部由 `nodeEditor` 端口注入，因此面板
不理解候选值的领域含义。该 editor 声明 `rendersEmptyState`，空值时仍渲染选择入口而不是
「未设置」占位。

Vector2 使用 X/Y，Size 使用 W/H；两者都保留在同一条属性行中（左侧名称、右侧并排子输入）。
启用变量绑定后，它们分别暴露稳定的 `x`/`y` 和 `width`/`height` 子目标。Size 可以把常见尺寸
嵌套在一个属性中，而不是额外创建一行 preset：

```ts
const outputSize = v.pipe(
  v.object({
    preset: v.pipe(
      v.picklist(['custom', 'hd']),
      v.metadata({ propertyPanel: { optionLabels: { custom: '自定义', hd: '1280 × 720' } } }),
    ),
    width: v.pipe(v.number(), v.minValue(1)),
    height: v.pipe(v.number(), v.minValue(1)),
  }),
  v.title('输出尺寸'),
  v.metadata({ propertyPanel: {
    editor: 'size',
    sizePresets: [{ value: 'hd', width: 1280, height: 720 }],
  } }),
)
```

选择 Size 预设会在一次提交中同步 preset/W/H；手动修改为不匹配的尺寸时会回到 schema
允许的 `custom` 值。Color 使用共享 `ComposeColorPicker`：支持 Alpha、透明色、Recent/Common、吸管和
折叠的精确 HEX/Alpha 输入，提交规范 `#rrggbb`、`#rrggbbaa` 或 `transparent`。`paint` editor 接受
`ComposePaint`，用于背景填充的 Solid/Linear/Radial/Angular gradient；宿主可通过
`paintEditor.onOpenChange` 和 `onEyedropperFallback` 连接 Stage 的渐变控制柄与图层取色。

`map` 是一个固定的单键分支属性：左侧属性列显示 Key，右侧 Value 根据当前 Key 的分支 Schema
自动复用内建或实例 renderer。它使用严格的 `v.variant('key', [...])`，每个分支必须恰好是
`{ key: v.literal(string), value: schema }`；父字段的 `optionLabels` 提供 Key 文案，
`mapValueDefaults` 为切换分支时提供有效 Value 初值。动态增删的键值集合继续使用 Valibot `record`。

```ts
const outputSize = v.pipe(
  v.variant('key', [
    v.object({ key: v.literal('preset'), value: v.picklist(['1280x720', '1920x1080']) }),
    v.object({
      key: v.literal('custom'),
      value: v.pipe(
        v.object({ width: v.pipe(v.number(), v.minValue(1)), height: v.pipe(v.number(), v.minValue(1)) }),
        v.metadata({ propertyPanel: { editor: 'size' } }),
      ),
    }),
  ]),
  v.title('输出尺寸'),
  v.metadata({ propertyPanel: {
    editor: 'map',
    optionLabels: { preset: '常见尺寸', custom: '自定义尺寸' },
    mapValueDefaults: { preset: '1280x720', custom: { width: 1, height: 1 } },
  } }),
)
```

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

<ComposePropertyPanel
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

renderer 可选 `labelComponent` 在左列替换静态属性名；它与 `component` 获得相同受控字段上下文。
`renderInlineValue` 仅用于 renderer 把子 Value 嵌入当前右列；Map 用它复用分支的内建和宿主
renderer，且不会创建独立变量绑定目标。

仓库示例在 `app/src/App.tsx` 中使用同一机制实现 ECharts `EChartOption` 自定义类型、结构化属性
编辑器和真实 Canvas 联动；ECharts 不属于本包的依赖或公共类型。

## 变量绑定

绑定关系与 Valibot 字面 input 分开受控。变量变化只更新 effective value，不会改写字面值或调用
`onValueChange`；宿主可以用同一个纯函数为 Canvas 计算实际属性：

绑定能力默认关闭。内置字段必须在 Schema 中显式声明允许绑定：

```ts
const schema = v.object({
  opacity: v.pipe(
    v.number(),
    v.metadata({ propertyPanel: {
      binding: { enabled: true, semanticScope: 'opacity' },
    } }),
  ),
  // 未声明 binding.enabled，仍是普通字面输入。
  cornerRadius: v.number(),
})
```

```tsx
import { ComposePropertyPanel, resolvePropertyBindings } from '@compose-ui/property-panel'

const variables = [
  { id: 'page.opacity', label: '页面透明度', scope: 'page', value: 0.65 },
] as const

const [bindings, setBindings] = useState([])

<ComposePropertyPanel
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

显式启用的内置叶子使用固定 target ID `value`。变量选择器会按目标 Schema、`semanticScope` 和
`canBind` 过滤候选，再按页面/全局作用域分组；未声明的目标即使出现在外部 bindings 中也不会生效，
并以 `unknown-target` issue 报告。变量缺失或失效时只回退该目标的字面值。已绑定输入保持可聚焦和
只读；解绑继续使用原字面值，reset 同时删除绑定并恢复 `defaultValue`。数组移动/删除、record 改键/
删除和 union 切换由面板同步维护绑定地址。

自定义类型同样默认不可绑定。字段 Schema 必须声明 `binding.enabled: true`，renderer 还要通过稳定
descriptor 明确暴露逻辑输入；两者缺一不可。Vector2 和 Size 已由内建语义类型实现这一约定，不需要
重复注册 renderer。下例说明宿主自定义复合类型如何声明同样的目标：

```tsx
const positionSchema = v.pipe(
  chartRangeSchema,
  v.metadata({ propertyPanel: {
    editor: 'chart-range',
    binding: { enabled: true },
  } }),
)

const chartRangeRenderer = {
  id: 'chart-range',
  component: ChartRangeEditor,
  bindingTargets: () => [{
    id: 'x',
    label: 'X',
    schema: v.number(),
    getValue: (value) => value.x,
    setValue: (value, x) => ({ ...value, x }),
  }],
}

function ChartRangeEditor({ value, commit, binding }) {
  const x = binding?.getTarget('x')
  return <div className="property-panel__binding-target">
    <div className="property-panel__binding-control">
      <input
        readOnly={Boolean(x?.binding)}
        value={x?.effectiveValue ?? value.x}
        onChange={(event) => commit({ ...value, x: Number(event.target.value) })}
      />
    </div>
    {binding?.renderTrigger('x')}
  </div>
}
```

`renderTrigger()` 返回已经带 `.property-panel__binding-slot` 的完整 accessory slot。renderer 只需把
控件主体与 slot 依次放入 `.property-panel__binding-target`；原输入、单位、色块或选择箭头应留在
`.property-panel__binding-control` 内。显式启用的目标始终显示 UE4 风格紧凑链条按钮；完整变量名和
解析状态通过 tooltip、ARIA description 与变量选择器提供，目标过窄时槽位会进一步收缩。

ECharts 等依赖仍由宿主 renderer 持有；本包只处理 target 描述、选择器、受控 bindings 和解析。

## 面板交互和主题

面板默认消费 `@compose-ui/ui-context` 的主题、语言、token 和
`propertyPanel.*` message 覆盖；Provider 外保留原有中文 chrome 与暗色视觉。Schema title、
description、option label 和自定义 renderer 内容始终由宿主控制，不会自动翻译。绑定解析继续
返回稳定 issue code，React 展示层才按当前 Context 本地化错误。

- 搜索匹配 title、key、完整路径和 description。
- 筛选支持全部、相对 `defaultValue` 已修改、以及有 Schema issue 的属性。
- 设置菜单可以显示高级属性、字段说明，并恢复列宽。
- 两条可聚焦分隔线分别调整属性名列和操作列；默认宽度为 160px/36px，方向键移动 8px，
  Shift 加方向键移动 24px。操作列限制在 32–96px、最多三槽；空间不足时使用溢出菜单，行右键
  菜单始终通过共享 `ComposeContextMenu` 提供全部操作；三点溢出仍是普通点击菜单。常规编辑控件在最大
  234px 的右对齐轨道中显示，窄面板会自动收缩。
- 嵌套结构只缩进标题、标签和引导线，编辑列边界保持全局对齐；深层缩进会自动封顶，避免属性名
  被层级空白挤压。
- 分组和字段的重置只在 `defaultValue` 能通过完整 Schema 时提供。

共享语义 token 是首选主题入口；单实例仍可在 `.property-panel` 或其祖先范围内覆盖
ComposePropertyPanel 专用变量：

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
  --pp-font-size: 12px;
  --pp-header-height: 52px;
  --pp-toolbar-height: 36px;
  --pp-group-height: 28px;
  --pp-nested-group-height: 26px;
  --pp-row-height: 26px;
  --pp-control-height: 22px;
  --pp-tree-indent: 14px;
  --pp-binding-slot-width: 36px;
  --pp-binding-slot-compact-width: 20px;
}
```

默认密度按 UE4 桌面 Details Panel 设置。自定义 renderer 应优先复用 `--pp-control-height` 和
`--pp-font-size`，这样宿主覆盖密度时，内置控件与领域控件仍保持同一行高和字号。字段说明、错误信息
及 `full-width` renderer 不受普通字段固定高度限制，会按内容自然增高。

首版只支持同步 Valibot Schema；异步 Schema 会显示可访问的不支持提示并停止渲染字段。
