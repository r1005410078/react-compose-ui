import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as v from 'valibot'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PropertyPanel, resolvePropertyBindings } from './index'
import type { PropertyPanelBinding, PropertyPanelRenderer } from './index'
import * as propertyPanelModule from './index'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

enum Alignment {
  Start = 'start',
  Center = 'center',
}

const basicSchema = v.object({
  label: v.pipe(v.string(), v.title('名称'), v.description('显示名称')),
  width: v.pipe(
    v.number(),
    v.minValue(0),
    v.maxValue(100),
    v.multipleOf(5),
    v.title('宽度'),
    v.metadata({ propertyPanel: { unit: 'px' } }),
  ),
  count: v.pipe(v.bigint(), v.title('数量')),
  enabled: v.pipe(v.boolean(), v.title('启用')),
  date: v.pipe(v.date(), v.title('日期')),
  kind: v.pipe(v.literal('rectangle'), v.title('类型')),
  mode: v.pipe(v.picklist(['bar', 'line']), v.title('模式')),
  alignment: v.pipe(v.enum(Alignment), v.title('对齐')),
})

const basicValue = {
  label: 'Rectangle',
  width: 20,
  count: 3n,
  enabled: true,
  date: new Date('2026-07-20T00:00:00.000Z'),
  kind: 'rectangle' as const,
  mode: 'bar' as const,
  alignment: Alignment.Center,
}

describe('OpenSpec: property-panel / 独立受控属性面板 / 宿主挂载属性面板', () => {
  it('渲染头部、根属性和 Schema 字段且不修改输入', () => {
    const input = { ...basicValue }
    render(
      <PropertyPanel
        aria-label="矩形属性"
        data-host="demo"
        header={{ title: 'Rectangle', subtitle: '基础节点', icon: 'R' }}
        schema={basicSchema}
        value={input}
      />,
    )

    const panel = screen.getByRole('region', { name: '矩形属性' })
    expect(panel).toHaveAttribute('data-host', 'demo')
    expect(within(panel).getByText('Rectangle')).toBeInTheDocument()
    expect(within(panel).getByLabelText('名称')).toHaveValue('Rectangle')
    expect(input).toEqual(basicValue)
  })
})

describe('OpenSpec: property-panel / Schema 类型自动映射 / 显示基础属性类型', () => {
  it('为基础类型显示匹配控件与约束', () => {
    render(<PropertyPanel schema={basicSchema} value={basicValue} />)

    expect(screen.getByLabelText('名称')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('宽度')).toHaveAttribute('min', '0')
    expect(screen.getByLabelText('宽度')).toHaveAttribute('max', '100')
    expect(screen.getByLabelText('宽度')).toHaveAttribute('step', '5')
    expect(screen.getByText('px')).toBeInTheDocument()
    expect(screen.getByLabelText('启用')).toBeChecked()
    expect(screen.getByLabelText('日期')).toHaveAttribute('type', 'date')
    expect(screen.getByText('rectangle')).toBeInTheDocument()
    expect(screen.getByLabelText('模式')).toHaveValue('bar')
    expect(screen.getByLabelText('对齐')).toHaveValue('center')
  })
})

describe('OpenSpec: property-panel / 有效受控变更 / 提交有效字段值', () => {
  it('提交完整 next input、路径、字段值、原因和 parsed output', () => {
    const onValueChange = vi.fn()
    render(
      <PropertyPanel
        schema={basicSchema}
        value={basicValue}
        onValueChange={onValueChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: 'Panel' } })

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith(
      { ...basicValue, label: 'Panel' },
      expect.objectContaining({
        path: ['label'],
        previousValue: 'Rectangle',
        value: 'Panel',
        reason: 'input',
        output: { ...basicValue, label: 'Panel' },
      }),
    )
  })
})

const structuredSchema = v.object({
  appearance: v.pipe(
    v.object({
      opacity: v.pipe(v.number(), v.minValue(0), v.maxValue(1), v.title('不透明度')),
    }),
    v.title('Appearance'),
  ),
  tags: v.pipe(v.array(v.string()), v.title('标签')),
  point: v.pipe(v.tuple([v.number(), v.number()]), v.title('坐标')),
  attributes: v.pipe(v.record(v.string(), v.number()), v.title('属性映射')),
  behavior: v.pipe(
    v.union([
      v.pipe(v.object({ kind: v.literal('static'), value: v.string() }), v.title('静态')),
      v.pipe(v.object({ kind: v.literal('dynamic'), speed: v.number() }), v.title('动态')),
    ]),
    v.title('行为'),
  ),
  note: v.pipe(v.optional(v.string()), v.title('备注')),
})

type StructuredValue = v.InferInput<typeof structuredSchema>

const structuredValue: StructuredValue = {
  appearance: { opacity: 1 },
  tags: ['alpha', 'beta'],
  point: [10, 20],
  attributes: { width: 100 },
  behavior: { kind: 'static', value: 'ready' },
}

function StructuredHarness({
  onChange = vi.fn(),
}: {
  onChange?: (value: StructuredValue, change: unknown) => void
}) {
  const [value, setValue] = useState(structuredValue)
  return (
    <PropertyPanel
      defaultValue={structuredValue}
      schema={structuredSchema}
      value={value}
      onValueChange={(nextValue, change) => {
        setValue(nextValue)
        onChange(nextValue, change)
      }}
    />
  )
}

function selectPropertyAction(ownerLabel: string, actionLabel: string) {
  const directAction = screen.queryByRole('button', { name: actionLabel })
  if (directAction) {
    fireEvent.click(directAction)
    return
  }
  fireEvent.click(screen.getByRole('button', { name: `更多 ${ownerLabel} 操作` }))
  fireEvent.click(screen.getByRole('menuitem', { name: actionLabel }))
}

describe('OpenSpec: property-panel / Schema 类型自动映射 / 显示存在性包装器', () => {
  it('为 optional 字段显示存在性控制并生成有效值', () => {
    const onChange = vi.fn()
    render(<StructuredHarness onChange={onChange} />)

    const presence = screen.getByRole('checkbox', { name: '备注 存在' })
    expect(presence).not.toBeChecked()
    fireEvent.click(presence)

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ note: '' }),
      expect.objectContaining({ path: ['note'], value: '', reason: 'set-presence' }),
    )
    expect(screen.getByLabelText('备注')).toHaveValue('')
  })
})

describe('OpenSpec: property-panel / 嵌套与集合属性编辑 / 编辑嵌套对象', () => {
  it('在可折叠分组中显示并编辑嵌套叶子', () => {
    const onChange = vi.fn()
    render(<StructuredHarness onChange={onChange} />)

    const group = screen.getByRole('button', { name: 'Appearance' })
    expect(group).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('不透明度')).toHaveValue(1)
    fireEvent.change(screen.getByLabelText('不透明度'), { target: { value: '0.5' } })
    fireEvent.blur(screen.getByLabelText('不透明度'))

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ appearance: { opacity: 0.5 } }),
      expect.objectContaining({ path: ['appearance', 'opacity'] }),
    )
    fireEvent.click(group)
    expect(screen.queryByLabelText('不透明度')).not.toBeInTheDocument()
  })
})

describe('OpenSpec: property-panel / 有效受控变更 / 保留无效输入草稿', () => {
  it('数字在 blur 时校验，无效草稿保留到修正后提交', () => {
    const schema = v.object({
      opacity: v.pipe(v.number(), v.minValue(0), v.maxValue(1), v.title('不透明度')),
    })
    const onValueChange = vi.fn()
    const { rerender } = render(
      <PropertyPanel schema={schema} value={{ opacity: 1 }} onValueChange={onValueChange} />,
    )
    const input = screen.getByLabelText('不透明度')

    fireEvent.change(input, { target: { value: '2' } })
    expect(input).toHaveValue(2)
    expect(onValueChange).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(screen.getByRole('alert')).toHaveTextContent(/1/u)
    expect(onValueChange).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '0.5' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onValueChange).toHaveBeenCalledWith(
      { opacity: 0.5 },
      expect.objectContaining({ path: ['opacity'], value: 0.5 }),
    )
    rerender(<PropertyPanel schema={schema} value={{ opacity: 0.5 }} onValueChange={onValueChange} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

interface ChartOptionFixture {
  series: readonly number[]
}

function isChartOptionFixture(input: unknown): input is ChartOptionFixture {
  return Boolean(
    input
    && typeof input === 'object'
    && Array.isArray((input as ChartOptionFixture).series),
  )
}

const chartSchema = v.object({
  chart: v.pipe(
    v.custom<ChartOptionFixture>(isChartOptionFixture),
    v.title('图表'),
    v.metadata({ propertyPanel: { editor: 'echart' } }),
  ),
})

function ChartRenderer({ value, commit }: import('./index').PropertyPanelRendererProps) {
  const chart = value as ChartOptionFixture
  return (
    <button
      aria-label={`编辑 ECharts ${chart.series.length} series`}
      type="button"
      onClick={() => commit({ series: [1, 2, 3] })}
    >
      编辑图表
    </button>
  )
}

describe('OpenSpec: property-panel / 自定义类型 Renderer Registry / 使用显式自定义 editor', () => {
  it('按 metadata editor ID 选择实例 renderer 并统一校验 commit', () => {
    const onValueChange = vi.fn()
    render(
      <PropertyPanel
        renderers={[{ id: 'echart', component: ChartRenderer }]}
        schema={chartSchema}
        value={{ chart: { series: [1] } }}
        onValueChange={onValueChange}
      />,
    )

    const editor = screen.getByRole('button', { name: '编辑 ECharts 1 series' })
    expect(editor.closest('.property-panel__field')).toHaveAttribute('data-property-layout', 'inline')
    fireEvent.click(editor)
    expect(onValueChange).toHaveBeenCalledWith(
      { chart: { series: [1, 2, 3] } },
      expect.objectContaining({ path: ['chart'], value: { series: [1, 2, 3] } }),
    )
  })
})

describe('OpenSpec: property-panel / 自定义类型 Renderer Registry / 使用全宽自定义 renderer', () => {
  it('使用 renderer 默认全宽布局并在标题行保留重置操作', () => {
    const onValueChange = vi.fn()
    render(
      <PropertyPanel
        defaultValue={{ chart: { series: [0] } }}
        renderers={[{ id: 'echart', component: ChartRenderer, layout: 'full-width' }]}
        schema={chartSchema}
        value={{ chart: { series: [1] } }}
        onValueChange={onValueChange}
      />,
    )

    const content = screen.getByRole('group', { name: '图表' })
    const field = content.closest('.property-panel__field')
    expect(field).toHaveAttribute('data-property-layout', 'full-width')
    expect(within(content).getByRole('button', { name: '编辑 ECharts 1 series' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '重置 图表' }))
    expect(onValueChange).toHaveBeenCalledWith(
      { chart: { series: [0] } },
      expect.objectContaining({ path: ['chart'], reason: 'reset' }),
    )
  })

  it('字段 metadata 可以双向覆盖 renderer 默认布局', () => {
    const fullWidthSchema = v.object({
      chart: v.pipe(
        v.custom<ChartOptionFixture>(isChartOptionFixture),
        v.title('全宽图表'),
        v.metadata({ propertyPanel: { editor: 'echart', layout: 'full-width' } }),
      ),
    })
    const inlineSchema = v.object({
      chart: v.pipe(
        v.custom<ChartOptionFixture>(isChartOptionFixture),
        v.title('行内图表'),
        v.metadata({ propertyPanel: { editor: 'echart', layout: 'inline' } }),
      ),
    })
    const { unmount } = render(
      <PropertyPanel
        renderers={[{ id: 'echart', component: ChartRenderer }]}
        schema={fullWidthSchema}
        value={{ chart: { series: [1] } }}
      />,
    )

    expect(screen.getByRole('group', { name: '全宽图表' }))
      .toHaveAttribute('data-property-renderer-content', '')
    unmount()

    render(
      <PropertyPanel
        renderers={[{ id: 'echart', component: ChartRenderer, layout: 'full-width' }]}
        schema={inlineSchema}
        value={{ chart: { series: [1] } }}
      />,
    )

    expect(screen.queryByRole('group', { name: '行内图表' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '编辑 ECharts 1 series' })
      .closest('.property-panel__field')).toHaveAttribute('data-property-layout', 'inline')
  })

  it('深层全宽字段保留封顶缩进和统一受控提交', () => {
    const schema = v.object({
      outer: v.pipe(v.object({
        inner: v.pipe(v.object({
          chart: v.pipe(
            v.custom<ChartOptionFixture>(isChartOptionFixture),
            v.title('深层图表'),
            v.metadata({ propertyPanel: { editor: 'echart' } }),
          ),
        }), v.title('Inner')),
      }), v.title('Outer')),
    })
    const onValueChange = vi.fn()
    render(
      <PropertyPanel
        renderers={[{ id: 'echart', component: ChartRenderer, layout: 'full-width' }]}
        schema={schema}
        value={{ outer: { inner: { chart: { series: [1] } } } }}
        onValueChange={onValueChange}
      />,
    )

    const content = screen.getByRole('group', { name: '深层图表' })
    const field = content.closest('.property-panel__field')
    expect(field).toHaveAttribute('data-property-depth', '2')
    expect(field).toHaveStyle({ '--pp-field-depth': '2', '--pp-branch-depth': '1' })

    fireEvent.click(within(content).getByRole('button', { name: '编辑 ECharts 1 series' }))
    expect(onValueChange).toHaveBeenCalledWith(
      { outer: { inner: { chart: { series: [1, 2, 3] } } } },
      expect.objectContaining({ path: ['outer', 'inner', 'chart'] }),
    )
  })

  it('全宽字段继续响应搜索、只读和 optional 存在性', () => {
    const customBase = v.custom<ChartOptionFixture>(isChartOptionFixture)
    const schema = v.object({
      chart: v.pipe(
        v.optional(customBase),
        v.title('可选图表'),
        v.metadata({ propertyPanel: { editor: 'echart' } }),
      ),
    })
    function ReadOnlyChartRenderer(props: import('./index').PropertyPanelRendererProps) {
      const chart = props.value as ChartOptionFixture
      return (
        <button disabled={props.readOnly} type="button">
          图表系列 {chart.series.length}
        </button>
      )
    }
    function Harness() {
      const [value, setValue] = useState<{ chart?: ChartOptionFixture }>({})
      return (
        <PropertyPanel
          readOnly={false}
          renderers={[{
            id: 'echart',
            component: ReadOnlyChartRenderer,
            createDefault: () => ({ series: [8] }),
            layout: 'full-width',
          }]}
          schema={schema}
          value={value}
          onValueChange={setValue}
        />
      )
    }
    const { unmount } = render(<Harness />)

    fireEvent.click(screen.getByRole('checkbox', { name: '可选图表 存在' }))
    expect(screen.getByRole('group', { name: '可选图表' })).toHaveTextContent('图表系列 1')
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索属性' }), {
      target: { value: '不匹配' },
    })
    expect(screen.queryByRole('group', { name: '可选图表' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索属性' }), {
      target: { value: '可选图表' },
    })
    expect(screen.getByRole('group', { name: '可选图表' })).toBeVisible()
    unmount()

    render(
      <PropertyPanel
        readOnly
        renderers={[{
          id: 'echart',
          component: ReadOnlyChartRenderer,
          layout: 'full-width',
        }]}
        schema={v.object({ chart: v.pipe(customBase, v.title('只读图表'), v.metadata({
          propertyPanel: { editor: 'echart' },
        })) })}
        value={{ chart: { series: [1] } }}
      />,
    )
    expect(screen.getByRole('button', { name: '图表系列 1' })).toBeDisabled()
  })
})

describe('OpenSpec: property-panel / 自定义类型 Renderer Registry / 缺少类型 renderer', () => {
  it('registry 保持实例隔离且不安全转换 custom 值', () => {
    const { unmount } = render(
      <PropertyPanel
        renderers={[{ id: 'echart', component: ChartRenderer }]}
        schema={chartSchema}
        value={{ chart: { series: [1] } }}
      />,
    )
    expect(screen.getByRole('button', { name: '编辑 ECharts 1 series' })).toBeInTheDocument()
    unmount()

    render(<PropertyPanel schema={chartSchema} value={{ chart: { series: [1] } }} />)
    expect(screen.getByRole('status')).toHaveTextContent('图表（custom）暂不支持')
    expect(screen.queryByRole('button', { name: /编辑 ECharts/u })).not.toBeInTheDocument()
  })
})

describe('OpenSpec: property-panel / 独立受控属性面板 / 使用异步 Schema', () => {
  it('显示同步版本不支持提示并禁用编辑', () => {
    const asyncSchema = v.objectAsync({ name: v.string() })
    render(
      <PropertyPanel
        schema={asyncSchema as unknown as v.GenericSchema}
        value={{ name: 'demo' }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('暂不支持异步 Valibot Schema')
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })
})

const panelSchema = v.object({
  transform: v.pipe(
    v.object({
      name: v.pipe(v.string(), v.title('名称'), v.description('节点显示名称')),
      x: v.pipe(v.number(), v.title('位置 X')),
    }),
    v.title('Transform'),
  ),
  appearance: v.pipe(
    v.object({
      opacity: v.pipe(v.number(), v.title('不透明度'), v.description('从 0 到 1')),
    }),
    v.title('Appearance'),
  ),
  diagnostics: v.pipe(
    v.object({ debug: v.pipe(v.boolean(), v.title('调试模式')) }),
    v.title('Diagnostics'),
    v.metadata({ propertyPanel: { advanced: true } }),
  ),
})

const panelDefaults = {
  transform: { name: 'Rectangle', x: 0 },
  appearance: { opacity: 1 },
  diagnostics: { debug: false },
}

const panelValue = {
  ...panelDefaults,
  appearance: { opacity: 0.5 },
}

describe('OpenSpec: property-panel / 搜索筛选与默认值重置 / 搜索嵌套属性', () => {
  it('搜索字段说明并保留祖先，清空后恢复内容', () => {
    render(<PropertyPanel defaultValue={panelDefaults} schema={panelSchema} value={panelValue} />)

    const search = screen.getByRole('searchbox', { name: '搜索属性' })
    fireEvent.change(search, { target: { value: '0 到 1' } })
    expect(screen.getByRole('button', { name: 'Appearance' })).toBeInTheDocument()
    expect(screen.getByLabelText('不透明度')).toBeInTheDocument()
    expect(screen.queryByLabelText('名称')).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getByLabelText('名称')).toBeInTheDocument()
  })
})

describe('OpenSpec: property-panel / 搜索筛选与默认值重置 / 筛选修改或错误', () => {
  it('仅显示相对 defaultValue 发生变化的字段', () => {
    render(<PropertyPanel defaultValue={panelDefaults} schema={panelSchema} value={panelValue} />)

    fireEvent.click(screen.getByRole('button', { name: '筛选属性' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '已修改' }))

    expect(screen.getByLabelText('不透明度')).toBeInTheDocument()
    expect(screen.queryByLabelText('名称')).not.toBeInTheDocument()
  })

  it('仅显示当前完整 Schema issue 所在字段及祖先', () => {
    const schema = v.object({
      transform: v.pipe(
        v.object({ x: v.pipe(v.number(), v.maxValue(10), v.title('位置 X')) }),
        v.title('Transform'),
      ),
      name: v.pipe(v.string(), v.title('名称')),
    })
    render(<PropertyPanel schema={schema} value={{ transform: { x: 20 }, name: 'Node' }} />)

    fireEvent.click(screen.getByRole('button', { name: '筛选属性' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '有错误' }))
    expect(screen.getByRole('button', { name: 'Transform' })).toBeInTheDocument()
    expect(screen.getByLabelText('位置 X')).toBeInTheDocument()
    expect(screen.queryByLabelText('名称')).not.toBeInTheDocument()
  })
})

describe('OpenSpec: property-panel / Metadata 驱动的展示属性 / 切换高级字段和说明', () => {
  it('设置菜单切换高级分组和字段说明', () => {
    render(<PropertyPanel defaultValue={panelDefaults} schema={panelSchema} value={panelValue} />)

    expect(screen.queryByRole('button', { name: 'Diagnostics' })).not.toBeInTheDocument()
    expect(screen.queryByText('节点显示名称')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '属性面板设置' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: '显示高级属性' }))
    fireEvent.click(screen.getByRole('button', { name: '属性面板设置' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: '显示字段说明' }))

    expect(screen.getByRole('button', { name: 'Diagnostics' })).toBeInTheDocument()
    expect(screen.getByText('节点显示名称')).toBeInTheDocument()
  })
})

describe('OpenSpec: property-panel / Metadata 驱动的展示属性 / 应用展示 metadata', () => {
  it('按 section 分组，并应用 hidden、readOnly 和初始折叠状态', () => {
    const schema = v.object({
      accent: v.pipe(
        v.string(),
        v.title('强调色'),
        v.metadata({ propertyPanel: { section: 'Appearance' } }),
      ),
      locked: v.pipe(
        v.string(),
        v.title('只读字段'),
        v.metadata({ propertyPanel: { readOnly: true } }),
      ),
      hidden: v.pipe(
        v.string(),
        v.title('隐藏字段'),
        v.metadata({ propertyPanel: { hidden: true } }),
      ),
      advanced: v.pipe(
        v.object({ enabled: v.pipe(v.boolean(), v.title('高级开关')) }),
        v.title('Advanced'),
        v.metadata({ propertyPanel: { collapsed: true } }),
      ),
    })
    render(<PropertyPanel schema={schema} value={{
      accent: '#3b82f6',
      locked: 'stable',
      hidden: 'secret',
      advanced: { enabled: true },
    }} />)

    expect(screen.getByRole('button', { name: 'Appearance' })).toBeInTheDocument()
    expect(screen.getByLabelText('强调色')).toHaveValue('#3b82f6')
    expect(screen.getByLabelText('只读字段')).toBeDisabled()
    expect(screen.queryByLabelText('隐藏字段')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('高级开关')).not.toBeInTheDocument()
  })
})

describe('OpenSpec: property-panel / 自定义类型 Renderer Registry / 使用显式自定义 editor', () => {
  it('matcher 可为 optional custom 提供 renderer 和有效默认值', () => {
    const customBase = v.custom<ChartOptionFixture>(isChartOptionFixture)
    const custom = v.optional(customBase)
    const schema = v.object({ chart: v.pipe(custom, v.title('可选图表')) })
    const onValueChange = vi.fn()
    render(
      <PropertyPanel
        renderers={[{
          id: 'matched-chart',
          matches: (candidate) => candidate === customBase,
          component: ChartRenderer,
          createDefault: () => ({ series: [8] }),
        }]}
        schema={schema}
        value={{}}
        onValueChange={onValueChange}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: '可选图表 存在' }))
    expect(onValueChange).toHaveBeenCalledWith(
      { chart: { series: [8] } },
      expect.objectContaining({ path: ['chart'], reason: 'set-presence' }),
    )
  })
})

describe('OpenSpec: property-panel / 双分隔线三列布局 / 指针调整两条分隔线', () => {
  it('宿主收窄时重新 clamp 列宽并保留最小编辑器宽度', () => {
    class ResizeObserverFixture {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback([{ contentRect: { width: 280 } } as ResizeObserverEntry], this)
      }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverFixture)
    render(<PropertyPanel schema={panelSchema} style={{ width: 500 }} value={panelValue} />)

    expect(screen.getByRole('separator', { name: '调整属性名列宽' }))
      .toHaveAttribute('aria-valuenow', '124')
    expect(screen.getByRole('separator', { name: '调整操作列宽' }))
      .toHaveAttribute('aria-valuenow', '36')
  })
})

describe('OpenSpec: property-panel / 搜索筛选与默认值重置 / 重置属性分组', () => {
  it('以默认分组值发出 reset 变更', () => {
    const onValueChange = vi.fn()
    render(
      <PropertyPanel
        defaultValue={panelDefaults}
        schema={panelSchema}
        value={panelValue}
        onValueChange={onValueChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '重置 Appearance' }))
    expect(onValueChange).toHaveBeenCalledWith(
      panelDefaults,
      expect.objectContaining({
        path: ['appearance'],
        previousValue: { opacity: 0.5 },
        value: { opacity: 1 },
        reason: 'reset',
      }),
    )
  })

  it('不存在有效字段默认值时不显示无效重置入口', () => {
    const schema = v.object({ items: v.pipe(v.array(v.string()), v.title('列表')) })
    render(
      <PropertyPanel
        defaultValue={{ items: ['默认项'] }}
        schema={schema}
        value={{ items: ['默认项', '新增项'] }}
      />,
    )

    expect(screen.queryByRole('button', { name: '重置 列表 2' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '更多 列表 操作' }))
    expect(screen.getByRole('menuitem', { name: '重置 列表' })).toBeInTheDocument()
  })
})

describe('OpenSpec: property-panel / 双分隔线三列布局 / 键盘调整分隔线', () => {
  // OpenSpec: property-panel / 双分隔线三列布局 / 恢复默认列宽
  it('分别调整两条分隔线并从设置菜单恢复默认宽度', () => {
    render(<PropertyPanel schema={panelSchema} style={{ width: 500 }} value={panelValue} />)

    const labelSeparator = screen.getByRole('separator', { name: '调整属性名列宽' })
    const actionSeparator = screen.getByRole('separator', { name: '调整操作列宽' })
    expect(labelSeparator).toHaveAttribute('aria-valuenow', '160')
    expect(actionSeparator).toHaveAttribute('aria-valuenow', '36')

    fireEvent.keyDown(labelSeparator, { key: 'ArrowRight' })
    fireEvent.keyDown(actionSeparator, { key: 'ArrowLeft', shiftKey: true })
    expect(labelSeparator).toHaveAttribute('aria-valuenow', '168')
    expect(actionSeparator).toHaveAttribute('aria-valuenow', '60')

    fireEvent.click(screen.getByRole('button', { name: '属性面板设置' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '恢复默认列宽' }))
    expect(labelSeparator).toHaveAttribute('aria-valuenow', '160')
    expect(actionSeparator).toHaveAttribute('aria-valuenow', '36')
  })
})

describe('OpenSpec: property-panel / 双分隔线三列布局 / 指针调整两条分隔线', () => {
  it('拖动时分别更新属性名列和操作列', () => {
    render(<PropertyPanel schema={panelSchema} style={{ width: 500 }} value={panelValue} />)
    const labelSeparator = screen.getByRole('separator', { name: '调整属性名列宽' })
    const actionSeparator = screen.getByRole('separator', { name: '调整操作列宽' })

    fireEvent.pointerDown(labelSeparator, { clientX: 128, pointerId: 1 })
    fireEvent.pointerMove(labelSeparator, { clientX: 168, pointerId: 1 })
    fireEvent.pointerUp(labelSeparator, { pointerId: 1 })
    expect(labelSeparator).toHaveAttribute('aria-valuenow', '200')

    fireEvent.pointerDown(actionSeparator, { clientX: 464, pointerId: 2 })
    fireEvent.pointerMove(actionSeparator, { clientX: 444, pointerId: 2 })
    fireEvent.pointerUp(actionSeparator, { pointerId: 2 })
    expect(actionSeparator).toHaveAttribute('aria-valuenow', '56')
  })
})

describe('OpenSpec: property-panel / 嵌套与集合属性编辑 / 修改数组和元组', () => {
  it('深层字段缩进封顶且不通过嵌套容器挤压共享编辑列', () => {
    const schema = v.object({
      level1: v.object({
        level2: v.object({
          level3: v.object({
            level4: v.object({
              level5: v.object({
                level6: v.object({ value: v.pipe(v.string(), v.title('深层字段')) }),
              }),
            }),
          }),
        }),
      }),
    })
    render(<PropertyPanel schema={schema} value={{
      level1: { level2: { level3: { level4: { level5: { level6: { value: 'visible' } } } } } },
    }} />)

    const field = screen.getByLabelText('深层字段').closest('.property-panel__field')
    expect(field).toHaveAttribute('data-property-depth', '6')
    expect(field).toHaveStyle({ '--pp-field-depth': '4' })
    expect(field).toHaveStyle({ '--pp-branch-depth': '3' })

    const deepestGroup = screen.getByRole('button', { name: 'Level6' }).closest('.property-panel__group')
    expect(deepestGroup).toHaveAttribute('data-property-depth', '5')
    expect(deepestGroup).toHaveStyle({ '--pp-group-depth': '3' })
  })

  it('新增、移动和删除数组项，并禁止删除 tuple 固定项', () => {
    const onChange = vi.fn()
    render(<StructuredHarness onChange={onChange} />)

    selectPropertyAction('标签', '添加 标签')
    expect(screen.getByLabelText('标签 3')).toHaveValue('')
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ tags: ['alpha', 'beta', ''] }),
      expect.objectContaining({ path: ['tags'], reason: 'array-add' }),
    )

    selectPropertyAction('标签 3', '上移 标签 3')
    expect(screen.getByLabelText('标签 2')).toHaveValue('')
    selectPropertyAction('标签 2', '删除 标签 2')
    expect(screen.queryByLabelText('标签 3')).not.toBeInTheDocument()

    expect(screen.getByLabelText('坐标 1')).toHaveValue(10)
    expect(screen.queryByRole('button', { name: '删除 坐标 1' })).not.toBeInTheDocument()
  })

  it('tupleWithRest 保留固定项并允许新增和删除 rest 项', () => {
    const schema = v.object({
      range: v.pipe(v.tupleWithRest([v.string()], v.number()), v.title('范围')),
    })
    function TupleRestHarness() {
      const [value, setValue] = useState<v.InferInput<typeof schema>>({ range: ['origin', 1] })
      return <PropertyPanel schema={schema} value={value} onValueChange={setValue} />
    }
    render(<TupleRestHarness />)

    expect(screen.queryByRole('button', { name: '删除 范围 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '删除 范围 2' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '添加 范围' }))
    expect(screen.getByLabelText('范围 3')).toHaveValue(0)
    fireEvent.click(screen.getByRole('button', { name: '删除 范围 3' }))
    expect(screen.queryByLabelText('范围 3')).not.toBeInTheDocument()
  })
})

describe('OpenSpec: property-panel / 嵌套与集合属性编辑 / 修改 record', () => {
  it('新增、重命名并删除 record 条目', () => {
    const onChange = vi.fn()
    render(<StructuredHarness onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '添加 属性映射' }))
    const keyInput = screen.getByLabelText('属性映射 键 2')
    expect(keyInput).toHaveValue('key')
    fireEvent.change(keyInput, { target: { value: 'height' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ attributes: { width: 100, height: 0 } }),
      expect.objectContaining({ path: ['attributes', 'key'], reason: 'record-rename' }),
    )
    fireEvent.click(screen.getByRole('button', { name: '删除 属性映射 height' }))
    expect(screen.queryByLabelText('属性映射 值 height')).not.toBeInTheDocument()
  })
})

describe('OpenSpec: property-panel / 嵌套与集合属性编辑 / 切换联合类型分支', () => {
  it('切换到能够生成有效默认值的 union 分支', () => {
    const onChange = vi.fn()
    render(<StructuredHarness onChange={onChange} />)

    const branch = screen.getByRole('combobox', { name: '行为 分支' })
    expect(branch).toHaveValue('0')
    fireEvent.change(branch, { target: { value: '1' } })

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: { kind: 'dynamic', speed: 0 } }),
      expect.objectContaining({ path: ['behavior'], reason: 'union-switch' }),
    )
    expect(screen.getByLabelText('Speed')).toHaveValue(0)
  })

  it('识别并切换带鉴别字段的 variant 分支', () => {
    const schema = v.object({
      config: v.pipe(
        v.variant('type', [
          v.pipe(v.object({ type: v.literal('bar'), gap: v.number() }), v.title('柱状图')),
          v.pipe(v.object({ type: v.literal('line'), smooth: v.boolean() }), v.title('折线图')),
        ]),
        v.title('配置'),
      ),
    })
    const onValueChange = vi.fn()
    render(
      <PropertyPanel
        schema={schema}
        value={{ config: { type: 'bar', gap: 4 } }}
        onValueChange={onValueChange}
      />,
    )

    fireEvent.change(screen.getByRole('combobox', { name: '配置 分支' }), {
      target: { value: '1' },
    })
    expect(onValueChange).toHaveBeenCalledWith(
      { config: { type: 'line', smooth: false } },
      expect.objectContaining({ path: ['config'], reason: 'union-switch' }),
    )
  })
})

describe('OpenSpec: property-panel / 自适应属性操作轨道 / 窄操作列容纳多个操作', () => {
  it('默认 36px 下把数组项的移动和删除操作收纳到同一溢出菜单', () => {
    const schema = v.object({ items: v.pipe(v.array(v.string()), v.title('列表')) })
    render(<PropertyPanel schema={schema} value={{ items: ['alpha', 'beta'] }} />)

    const overflow = screen.getByRole('button', { name: '更多 列表 1 操作' })
    expect(overflow).toBeVisible()
    expect(screen.queryByRole('button', { name: '上移 列表 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '下移 列表 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除 列表 1' })).not.toBeInTheDocument()

    fireEvent.click(overflow)
    const menu = screen.getByRole('menu', { name: '列表 1 操作' })
    expect(within(menu).getByRole('menuitem', { name: '上移 列表 1' })).toBeDisabled()
    expect(within(menu).getByRole('menuitem', { name: '下移 列表 1' })).toBeEnabled()
    expect(within(menu).getByRole('menuitem', { name: '删除 列表 1' })).toBeEnabled()
  })
})

describe('OpenSpec: property-panel / 自适应属性操作轨道 / 扩大操作列逐步显示操作', () => {
  it('把操作列限制在 32 至 96px 并通过键盘逐步增加可见槽位', () => {
    const schema = v.object({ items: v.pipe(v.array(v.string()), v.title('列表')) })
    render(<PropertyPanel schema={schema} style={{ width: 500 }} value={{ items: ['alpha', 'beta'] }} />)
    const separator = screen.getByRole('separator', { name: '调整操作列宽' })

    expect(separator).toHaveAttribute('aria-valuemin', '32')
    expect(separator).toHaveAttribute('aria-valuemax', '96')
    fireEvent.keyDown(separator, { key: 'ArrowLeft', shiftKey: true })
    expect(separator).toHaveAttribute('aria-valuenow', '60')
    fireEvent.keyDown(separator, { key: 'ArrowLeft', shiftKey: true })
    fireEvent.keyDown(separator, { key: 'ArrowLeft', shiftKey: true })
    expect(separator).toHaveAttribute('aria-valuenow', '96')
    expect(screen.getByRole('button', { name: '下移 列表 1' })).toBeVisible()
    expect(screen.getByRole('button', { name: '删除 列表 1' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '更多 列表 1 操作' })).not.toBeInTheDocument()
  })
})

describe('OpenSpec: property-panel / 自适应属性操作轨道 / 通过行上下文菜单执行操作', () => {
  it('右键属性行显示完整操作集合', () => {
    const schema = v.object({ items: v.pipe(v.array(v.string()), v.title('列表')) })
    render(<PropertyPanel schema={schema} value={{ items: ['alpha', 'beta'] }} />)
    const row = screen.getByLabelText('列表 1').closest('[data-property-path="items.0"]')
    expect(row).not.toBeNull()

    fireEvent.contextMenu(row!)
    const menu = screen.getByRole('menu', { name: '列表 1 操作' })
    expect(within(menu).getByRole('menuitem', { name: '删除 列表 1' })).toBeVisible()
  })
})

describe('OpenSpec: property-panel / 受控属性变量绑定 / 绑定类型兼容变量', () => {
  it('OpenSpec: property-panel / 受控属性变量绑定 / 未声明字段不启用变量绑定', () => {
    expect(propertyPanelModule).toHaveProperty('resolvePropertyBindings')
    const schema = v.object({ title: v.pipe(v.string(), v.title('标题')) })
    const experimentalProps = {
      binding: {
        value: [],
        variables: [{ id: 'page.opacity', label: '页面不透明度', scope: 'page', value: 0.6 }],
        onChange: vi.fn(),
      },
    } as Record<string, unknown>
    render(<PropertyPanel
      {...experimentalProps}
      schema={schema}
      value={{ title: 'Literal' }}
    />)

    expect(screen.queryByRole('button', { name: '绑定 标题' })).not.toBeInTheDocument()

    const result = resolvePropertyBindings({
      schema,
      value: { title: 'Literal' },
      bindings: [{ target: { path: ['title'], targetId: 'value' }, variableId: 'page.title' }],
      variables: [{ id: 'page.title', label: '页面标题', scope: 'page', value: 'Bound' }],
    })
    expect(result.value).toEqual({ title: 'Literal' })
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'unknown-target',
        target: { path: ['title'], targetId: 'value' },
      }),
    ])

    const pointSchema = v.custom<{ x: number }>((value) => (
      Boolean(value && typeof value === 'object' && 'x' in value)
    ))
    const customSchema = v.object({
      point: v.pipe(
        pointSchema,
        v.title('坐标'),
        v.metadata({ propertyPanel: { editor: 'point' } }),
      ),
    })
    const pointRenderer: PropertyPanelRenderer = {
      id: 'point',
      component: ({ binding }) => <output>{binding ? 'binding-on' : 'binding-off'}</output>,
      bindingTargets: () => [{
        id: 'x',
        label: 'X',
        schema: v.number(),
        getValue: (value) => (value as { x: number }).x,
        setValue: (value, targetValue) => ({ ...(value as object), x: targetValue }),
      }],
    }
    render(
      <PropertyPanel
        binding={{ value: [], variables: [], onChange: vi.fn() }}
        renderers={[pointRenderer]}
        schema={customSchema}
        value={{ point: { x: 1 } }}
      />,
    )
    expect(screen.getByText('binding-off')).toBeInTheDocument()

    const customResult = resolvePropertyBindings({
      schema: customSchema,
      value: { point: { x: 1 } },
      bindings: [{ target: { path: ['point'], targetId: 'x' }, variableId: 'page.x' }],
      variables: [{ id: 'page.x', label: '页面 X', scope: 'page', value: 8 }],
      renderers: [pointRenderer],
    })
    expect(customResult.value).toEqual({ point: { x: 1 } })
    expect(customResult.issues).toEqual([
      expect.objectContaining({
        code: 'unknown-target',
        target: { path: ['point'], targetId: 'x' },
      }),
    ])
  })

  it('OpenSpec: property-panel / 受控属性变量绑定 / 显式启用内置字段变量绑定', () => {
    const schema = v.object({
      opacity: v.pipe(
        v.number(),
        v.title('不透明度'),
        v.metadata({ propertyPanel: { binding: { enabled: true } } }),
      ),
    })
    render(
      <PropertyPanel
        binding={{
          value: [],
          variables: [],
          onChange: vi.fn(),
        }}
        schema={schema}
        value={{ opacity: 1 }}
      />,
    )

    expect(screen.getByRole('button', { name: '绑定 不透明度' })).toBeInTheDocument()
  })

  it('OpenSpec: property-panel / 受控属性变量绑定 / 绑定入口不遮挡原控件', () => {
    const schema = v.object({
      opacity: v.pipe(
        v.number(),
        v.title('不透明度'),
        v.metadata({ propertyPanel: { binding: { enabled: true } } }),
      ),
      title: v.pipe(v.string(), v.title('标题')),
    })
    render(
      <PropertyPanel
        binding={{
          value: [{ target: { path: ['opacity'], targetId: 'value' }, variableId: 'page.opacity' }],
          variables: [{
            id: 'page.opacity',
            label: '页面中的超长不透明度变量',
            scope: 'page',
            value: 0.6,
          }],
          onChange: vi.fn(),
        }}
        schema={schema}
        value={{ opacity: 1, title: 'Literal' }}
      />,
    )

    const input = screen.getByLabelText('不透明度')
    const trigger = screen.getByRole('button', { name: '更换绑定 不透明度' })
    const slot = trigger.closest<HTMLElement>('.property-panel__binding-slot')
    const target = trigger.closest<HTMLElement>('.property-panel__binding-target')

    expect(input).toHaveValue(0.6)
    expect(input).toHaveAttribute('readonly')
    expect(slot).toHaveAttribute('data-binding-state', 'bound')
    expect(slot).toHaveTextContent('页面中的超长不透明度变量')
    expect(target).toContainElement(input)
    expect(target).toContainElement(slot)
    expect(input.closest('.property-panel__binding-control')?.nextElementSibling).toBe(slot)
    expect(screen.getByLabelText('标题').closest('.property-panel__binding-target')).toBeNull()
  })

  it('把宿主自定义 trigger 包裹在统一绑定槽位内', () => {
    const schema = v.object({
      title: v.pipe(
        v.string(),
        v.title('标题'),
        v.metadata({ propertyPanel: { binding: { enabled: true } } }),
      ),
    })
    render(
      <PropertyPanel
        binding={{
          value: [],
          variables: [],
          onChange: vi.fn(),
          renderTrigger: ({ target }) => (
            <button aria-label={`自定义绑定 ${target.label}`} type="button">自定义</button>
          ),
        }}
        schema={schema}
        value={{ title: 'Literal' }}
      />,
    )

    const trigger = screen.getByRole('button', { name: '自定义绑定 标题' })
    expect(trigger.closest('.property-panel__binding-slot')).toHaveAttribute(
      'data-binding-state',
      'literal',
    )
    expect(trigger.closest('.property-panel__binding-target')).toContainElement(
      screen.getByLabelText('标题'),
    )
  })

  it('只应用通过目标和完整根 Schema 的变量并逐目标回退字面值', () => {
    const schema = v.object({
      opacity: v.pipe(
        v.number(),
        v.minValue(0),
        v.maxValue(1),
        v.title('不透明度'),
        v.metadata({ propertyPanel: { binding: { enabled: true } } }),
      ),
      title: v.pipe(
        v.string(),
        v.metadata({ propertyPanel: { binding: { enabled: true } } }),
      ),
    })
    const literal = { opacity: 1, title: 'Literal' }
    const result = resolvePropertyBindings({
      schema,
      value: literal,
      bindings: [
        { target: { path: ['opacity'], targetId: 'value' }, variableId: 'page.opacity' },
        { target: { path: ['title'], targetId: 'value' }, variableId: 'missing.title' },
      ],
      variables: [{ id: 'page.opacity', label: '页面不透明度', scope: 'page', value: 0.6 }],
    })

    expect(result.value).toEqual({ opacity: 0.6, title: 'Literal' })
    expect(result.output).toEqual({ opacity: 0.6, title: 'Literal' })
    expect(result.targets.map((target) => target.status)).toEqual(['resolved', 'missing-variable'])
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'missing-variable', target: { path: ['title'], targetId: 'value' } }),
    ])
    expect(literal).toEqual({ opacity: 1, title: 'Literal' })
  })

  it('筛选兼容变量并在绑定、只读预览和解绑之间保持字面值', () => {
    const schema = v.object({
      opacity: v.pipe(
        v.number(),
        v.title('不透明度'),
        v.metadata({ propertyPanel: { binding: { enabled: true, semanticScope: 'opacity' } } }),
      ),
    })
    const onValueChange = vi.fn()
    function BindingHarness() {
      const [bindings, setBindings] = useState<readonly PropertyPanelBinding[]>([])
      return (
        <PropertyPanel
          binding={{
            value: bindings,
            variables: [
              {
                id: 'page.opacity',
                label: '页面不透明度',
                scope: 'page',
                value: 0.6,
                semanticScopes: ['opacity'],
              },
              {
                id: 'global.opacity',
                label: '全局透明度',
                scope: 'global',
                value: 0.4,
                semanticScopes: ['opacity'],
              },
              {
                id: 'page.forbiddenOpacity',
                label: '禁止透明度',
                scope: 'page',
                value: 0.2,
                semanticScopes: ['opacity'],
              },
              { id: 'global.count', label: '全局计数', scope: 'global', value: 8 },
              { id: 'global.title', label: '全局标题', scope: 'global', value: 'wrong' },
            ],
            onChange: (next) => setBindings(next),
            canBind: (_target, variable) => variable.id !== 'page.forbiddenOpacity',
          }}
          schema={schema}
          value={{ opacity: 1 }}
          onValueChange={onValueChange}
        />
      )
    }
    render(<BindingHarness />)

    fireEvent.click(screen.getByRole('button', { name: '绑定 不透明度' }))
    expect(screen.getByRole('heading', { name: '页面变量' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '全局变量' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /页面不透明度/ })).toBeInTheDocument()
    expect(screen.queryByText('全局计数')).not.toBeInTheDocument()
    expect(screen.queryByText('全局标题')).not.toBeInTheDocument()
    expect(screen.queryByText('禁止透明度')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索变量' }), {
      target: { value: '页面' },
    })
    expect(screen.getByRole('button', { name: /页面不透明度/ })).toBeInTheDocument()
    expect(screen.queryByText('全局透明度')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /页面不透明度/ }))

    expect(screen.getByLabelText('不透明度')).toHaveValue(0.6)
    expect(screen.getByLabelText('不透明度')).toHaveAttribute('readonly')
    fireEvent.change(screen.getByLabelText('不透明度'), { target: { value: '0.2' } })
    expect(onValueChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '更换绑定 不透明度' }))
    fireEvent.click(screen.getByRole('button', { name: '解绑' }))
    expect(screen.getByLabelText('不透明度')).toHaveValue(1)
  })

  it('把绑定计入修改和错误筛选，并在 reset 时同时删除绑定', () => {
    const schema = v.object({
      opacity: v.pipe(
        v.number(),
        v.title('不透明度'),
        v.metadata({ propertyPanel: { binding: { enabled: true } } }),
      ),
    })
    const onBindingChange = vi.fn()
    render(
      <PropertyPanel
        binding={{
          value: [{ target: { path: ['opacity'], targetId: 'value' }, variableId: 'missing' }],
          variables: [],
          onChange: onBindingChange,
        }}
        defaultValue={{ opacity: 1 }}
        schema={schema}
        value={{ opacity: 1 }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '筛选属性' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '有错误' }))
    expect(screen.getByLabelText('不透明度')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '筛选属性' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '已修改' }))
    expect(screen.getByLabelText('不透明度')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重置 不透明度' }))
    expect(onBindingChange).toHaveBeenCalledWith([], {
      reason: 'reset',
      target: { path: ['opacity'], targetId: 'value' },
    })
  })

  it('通过 renderer 子目标分别解析复合字段', () => {
    const pointSchema = v.custom<{ x: number; y: number }>((value) => (
      Boolean(value && typeof value === 'object' && 'x' in value && 'y' in value)
    ))
    const schema = v.object({
      position: v.pipe(
        pointSchema,
        v.title('位置'),
        v.metadata({ propertyPanel: { editor: 'point', binding: { enabled: true } } }),
      ),
    })
    const renderer: PropertyPanelRenderer = {
      id: 'point',
      component: () => null,
      bindingTargets: () => [
        {
          id: 'x', label: 'X', schema: v.number(),
          getValue: (value) => (value as { x: number }).x,
          setValue: (value, targetValue) => ({ ...(value as object), x: targetValue }),
        },
        {
          id: 'y', label: 'Y', schema: v.number(),
          getValue: (value) => (value as { y: number }).y,
          setValue: (value, targetValue) => ({ ...(value as object), y: targetValue }),
        },
      ],
    }
    const result = resolvePropertyBindings({
      schema,
      value: { position: { x: 1, y: 2 } },
      bindings: [{ target: { path: ['position'], targetId: 'x' }, variableId: 'page.x' }],
      variables: [{ id: 'page.x', label: '页面 X', scope: 'page', value: 12 }],
      renderers: [renderer],
    })

    expect(result.value).toEqual({ position: { x: 12, y: 2 } })
  })

  it('为显式启用的自定义 renderer 子目标提供绑定槽位', () => {
    const pointSchema = v.custom<{ x: number; y: number }>((value) => (
      Boolean(value && typeof value === 'object' && 'x' in value && 'y' in value)
    ))
    const schema = v.object({
      position: v.pipe(
        pointSchema,
        v.title('位置'),
        v.metadata({ propertyPanel: { editor: 'point', binding: { enabled: true } } }),
      ),
    })
    const renderer: PropertyPanelRenderer = {
      id: 'point',
      component: ({ binding }) => (
        <div>
          {binding?.renderTrigger('x')}
          {binding?.renderTrigger('y')}
        </div>
      ),
      bindingTargets: () => [
        {
          id: 'x', label: 'X', schema: v.number(),
          getValue: (value) => (value as { x: number }).x,
          setValue: (value, targetValue) => ({ ...(value as object), x: targetValue }),
        },
        {
          id: 'y', label: 'Y', schema: v.number(),
          getValue: (value) => (value as { y: number }).y,
          setValue: (value, targetValue) => ({ ...(value as object), y: targetValue }),
        },
      ],
    }
    render(
      <PropertyPanel
        binding={{ value: [], variables: [], onChange: vi.fn() }}
        renderers={[renderer]}
        schema={schema}
        value={{ position: { x: 1, y: 2 } }}
      />,
    )

    expect(screen.getByRole('button', { name: '绑定 X' }))
      .toHaveClass('property-panel__binding-trigger')
    expect(screen.getByRole('button', { name: '绑定 Y' }).closest('.property-panel__binding-slot'))
      .toHaveAttribute('data-binding-state', 'literal')
  })

  it('变量快照更新只刷新 effective value，不发出字面值提交', () => {
    const schema = v.object({
      opacity: v.pipe(
        v.number(),
        v.title('不透明度'),
        v.metadata({ propertyPanel: { binding: { enabled: true } } }),
      ),
    })
    const onValueChange = vi.fn()
    function Harness() {
      const [variableValue, setVariableValue] = useState(0.6)
      return (
        <>
          <button type="button" onClick={() => setVariableValue(0.3)}>更新变量</button>
          <PropertyPanel
            binding={{
              value: [{ target: { path: ['opacity'], targetId: 'value' }, variableId: 'opacity' }],
              variables: [{ id: 'opacity', label: '透明度', scope: 'page', value: variableValue }],
              onChange: vi.fn(),
            }}
            schema={schema}
            value={{ opacity: 1 }}
            onValueChange={onValueChange}
          />
        </>
      )
    }
    render(<Harness />)

    expect(screen.getByLabelText('不透明度')).toHaveValue(0.6)
    fireEvent.click(screen.getByRole('button', { name: '更新变量' }))
    expect(screen.getByLabelText('不透明度')).toHaveValue(0.3)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('只读面板中的已绑定输入仍可聚焦，但不能修改绑定或字面值', () => {
    const schema = v.object({
      title: v.pipe(
        v.string(),
        v.title('标题'),
        v.metadata({ propertyPanel: { binding: { enabled: true } } }),
      ),
    })
    render(
      <PropertyPanel
        binding={{
          value: [{ target: { path: ['title'], targetId: 'value' }, variableId: 'title' }],
          variables: [{ id: 'title', label: '页面标题', scope: 'page', value: 'Bound' }],
          onChange: vi.fn(),
        }}
        readOnly
        schema={schema}
        value={{ title: 'Literal' }}
      />,
    )

    const input = screen.getByLabelText('标题')
    expect(input).toHaveValue('Bound')
    expect(input).not.toBeDisabled()
    expect(input).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: '更换绑定 标题' })).toBeDisabled()
  })
})

describe('OpenSpec: property-panel / 结构操作维护绑定地址 / 数组和 Record 重映射绑定', () => {
  it('数组项移动和删除时同步移动或移除后代绑定', () => {
    const schema = v.object({ items: v.pipe(v.array(v.string()), v.title('列表')) })
    const onBindingChange = vi.fn()
    function Harness() {
      const [value, setValue] = useState({ items: ['alpha', 'beta'] })
      const [bindings, setBindings] = useState<readonly PropertyPanelBinding[]>([
        { target: { path: ['items', 0], targetId: 'value' }, variableId: 'first' },
        { target: { path: ['items', 1], targetId: 'value' }, variableId: 'second' },
      ])
      return (
        <PropertyPanel
          binding={{
            value: bindings,
            variables: [
              { id: 'first', label: '第一项', scope: 'page', value: 'A' },
              { id: 'second', label: '第二项', scope: 'page', value: 'B' },
            ],
            onChange: (next, change) => {
              setBindings(next)
              onBindingChange(next, change)
            },
          }}
          schema={schema}
          value={value}
          onValueChange={setValue}
        />
      )
    }
    render(<Harness />)

    selectPropertyAction('列表 1', '下移 列表 1')
    expect(onBindingChange).toHaveBeenLastCalledWith([
      { target: { path: ['items', 1], targetId: 'value' }, variableId: 'first' },
      { target: { path: ['items', 0], targetId: 'value' }, variableId: 'second' },
    ], expect.objectContaining({ reason: 'remap' }))

    selectPropertyAction('列表 1', '删除 列表 1')
    expect(onBindingChange).toHaveBeenLastCalledWith([
      { target: { path: ['items', 0], targetId: 'value' }, variableId: 'first' },
    ], expect.objectContaining({ reason: 'remap' }))
  })

  it('record 改键和删除、union 切换会重映射或清理后代绑定', () => {
    const schema = v.object({
      values: v.pipe(v.record(v.string(), v.number()), v.title('映射')),
      mode: v.pipe(v.union([
        v.object({ type: v.literal('a'), value: v.string() }),
        v.object({ type: v.literal('b'), count: v.number() }),
      ]), v.title('模式')),
    })
    const onBindingChange = vi.fn()
    function Harness() {
      const [value, setValue] = useState<v.InferInput<typeof schema>>({
        values: { width: 10 },
        mode: { type: 'a' as const, value: 'literal' } as { type: 'a'; value: string } | { type: 'b'; count: number },
      })
      const [bindings, setBindings] = useState<readonly PropertyPanelBinding[]>([
        { target: { path: ['values', 'width'], targetId: 'value' }, variableId: 'width' },
        { target: { path: ['mode', 'value'], targetId: 'value' }, variableId: 'mode' },
      ])
      return (
        <PropertyPanel
          binding={{
            value: bindings,
            variables: [
              { id: 'width', label: '宽度', scope: 'page', value: 20 },
              { id: 'mode', label: '内容', scope: 'page', value: 'bound' },
            ],
            onChange: (next, change) => {
              setBindings(next)
              onBindingChange(next, change)
            },
          }}
          schema={schema}
          value={value}
          onValueChange={setValue}
        />
      )
    }
    render(<Harness />)

    fireEvent.change(screen.getByLabelText('映射 键 1'), { target: { value: 'height' } })
    expect(onBindingChange).toHaveBeenLastCalledWith(expect.arrayContaining([
      { target: { path: ['values', 'height'], targetId: 'value' }, variableId: 'width' },
    ]), expect.objectContaining({ reason: 'remap' }))

    fireEvent.change(screen.getByRole('combobox', { name: '模式 分支' }), { target: { value: '1' } })
    expect(onBindingChange).toHaveBeenLastCalledWith([
      { target: { path: ['values', 'height'], targetId: 'value' }, variableId: 'width' },
    ], expect.objectContaining({ reason: 'remap' }))
  })
})
