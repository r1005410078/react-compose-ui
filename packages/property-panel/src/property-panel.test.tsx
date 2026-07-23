import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as v from 'valibot'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PropertyPanel } from './index'

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

  it('受控值回退后不复用已提交的新值草稿', () => {
    const onValueChange = vi.fn()
    const { rerender } = render(
      <PropertyPanel
        schema={basicSchema}
        value={basicValue}
        onValueChange={onValueChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: 'Panel' } })
    rerender(
      <PropertyPanel
        schema={basicSchema}
        value={{ ...basicValue, label: 'Panel' }}
        onValueChange={onValueChange}
      />,
    )
    rerender(
      <PropertyPanel
        schema={basicSchema}
        value={basicValue}
        onValueChange={onValueChange}
      />,
    )

    expect(screen.getByLabelText('名称')).toHaveValue('Rectangle')
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

    fireEvent.click(screen.getByRole('button', { name: '编辑 ECharts 1 series' }))
    expect(onValueChange).toHaveBeenCalledWith(
      { chart: { series: [1, 2, 3] } },
      expect.objectContaining({ path: ['chart'], value: { series: [1, 2, 3] } }),
    )
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
    expect(screen.getByRole('button', { name: '重置 列表' })).toBeInTheDocument()
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
  it('新增、移动和删除数组项，并禁止删除 tuple 固定项', () => {
    const onChange = vi.fn()
    render(<StructuredHarness onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '添加 标签' }))
    expect(screen.getByLabelText('标签 3')).toHaveValue('')
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ tags: ['alpha', 'beta', ''] }),
      expect.objectContaining({ path: ['tags'], reason: 'array-add' }),
    )

    fireEvent.click(screen.getByRole('button', { name: '上移 标签 3' }))
    expect(screen.getByLabelText('标签 2')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: '删除 标签 2' }))
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
