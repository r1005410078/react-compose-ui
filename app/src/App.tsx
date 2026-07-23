import { ComposeEditor } from '@compose-ui/editor'
import { useHistory } from '@compose-ui/history'
import {
  PropertyPanel,
} from '@compose-ui/property-panel'
import type {
  PropertyPanelChange,
  PropertyPanelRendererProps,
} from '@compose-ui/property-panel'
import type { SceneTreeNode, SceneTreeOperation } from '@compose-ui/scene-tree'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { init as initECharts, use as registerECharts } from 'echarts/core'
import type { EChartsOption } from 'echarts'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as v from 'valibot'
import '@compose-ui/property-panel/styles.css'
import './App.css'

interface TextComponent {
  id: string
  text: string
  defaultText: string
  keywords: string[]
  defaultKeywords: string[]
}

interface ChartComponent {
  id: string
  option: EChartsOption
  defaultOption: EChartsOption
}

interface AxisPair {
  x: number
  y: number
}

interface SizePair {
  width: number
  height: number
}

interface RectangleProperties {
  transform: {
    position: AxisPair
    size: SizePair
    anchor: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    angle: number
    scale: AxisPair
  }
  appearance: {
    color: string
    opacity: number
    cornerRadius: number
  }
  propertyDemo: {
    border: {
      stroke: {
        color: string
        width: number
      }
    }
  }
  layout: {
    horizontalAlignment: 'start' | 'center' | 'end' | 'stretch'
    verticalAlignment: 'start' | 'center' | 'end' | 'stretch'
  }
  state: {
    enabled: boolean
    visibility: 'visible' | 'hidden'
  }
  advanced: {
    pixelSnapping: boolean
  }
  diagnostics: {
    debugBounds: boolean
  }
}

interface RectangleComponent {
  id: string
  properties: RectangleProperties
  defaultProperties: RectangleProperties
}

interface DemoDocumentSnapshot {
  textComponents: readonly TextComponent[]
  chartComponents: readonly ChartComponent[]
  rectangleComponents: readonly RectangleComponent[]
  sceneNodes: readonly SceneTreeNode[]
}

type DemoChartType = 'bar' | 'line' | 'pie'

interface DemoChartConfig {
  title: string
  type: DemoChartType
  seriesName: string
  data: number[]
}

registerECharts([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
])

const DEFAULT_CHART_CONFIG: DemoChartConfig = {
  title: '季度销售额',
  type: 'bar',
  seriesName: '销售额',
  data: [12, 24, 18, 36],
}

const textPropertySchema = v.object({
  content: v.pipe(
    v.object({
      text: v.pipe(
        v.string(),
        v.title('文本内容'),
        v.description('显示在画布和场景树中的文本'),
      ),
      keywords: v.pipe(
        v.array(v.string()),
        v.title('关键词'),
        v.description('演示由 Schema 驱动的数组增删和排序'),
      ),
    }),
    v.title('Content'),
  ),
})

const chartPropertySchema = v.object({
  chart: v.pipe(
    v.object({
      option: v.pipe(
        v.custom<EChartsOption>(isEChartsOption, '请输入有效的 EChartsOption'),
        v.title('图表配置'),
        v.description('通过实例 renderer 编辑并实时应用到 ECharts'),
        v.metadata({ propertyPanel: { editor: 'echart' } }),
      ),
    }),
    v.title('Chart'),
  ),
})

const axisPairSchema = v.custom<AxisPair>((input) => (
  isRecord(input)
  && typeof input.x === 'number'
  && Number.isFinite(input.x)
  && typeof input.y === 'number'
  && Number.isFinite(input.y)
))

const sizePairSchema = v.custom<SizePair>((input) => (
  isRecord(input)
  && typeof input.width === 'number'
  && Number.isFinite(input.width)
  && typeof input.height === 'number'
  && Number.isFinite(input.height)
))

const rectanglePropertySchema = v.object({
  transform: v.pipe(
    v.object({
      position: v.pipe(
        axisPairSchema,
        v.title('位置 Position'),
        v.metadata({ propertyPanel: { editor: 'vector2' } }),
      ),
      size: v.pipe(
        sizePairSchema,
        v.title('尺寸 Size'),
        v.metadata({ propertyPanel: { editor: 'size2' } }),
      ),
      anchor: v.pipe(
        v.picklist(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right']),
        v.title('锚点 Anchor'),
        v.metadata({ propertyPanel: { optionLabels: {
          center: '中心',
          'top-left': '左上',
          'top-right': '右上',
          'bottom-left': '左下',
          'bottom-right': '右下',
        } } }),
      ),
      angle: v.pipe(
        v.number(),
        v.title('旋转 Angle'),
        v.metadata({ propertyPanel: { unit: '°' } }),
      ),
      scale: v.pipe(
        axisPairSchema,
        v.title('缩放 Scale'),
        v.metadata({ propertyPanel: { editor: 'vector2' } }),
      ),
    }),
    v.title('Transform'),
  ),
  appearance: v.pipe(
    v.object({
      color: v.pipe(
        v.string(),
        v.title('颜色 Color'),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
      opacity: v.pipe(v.number(), v.minValue(0), v.maxValue(1), v.title('不透明度 Opacity')),
      cornerRadius: v.pipe(
        v.number(),
        v.minValue(0),
        v.title('圆角 Corner Radius'),
      ),
    }),
    v.title('Appearance'),
  ),
  propertyDemo: v.pipe(
    v.object({
      border: v.pipe(
        v.object({
          stroke: v.pipe(
            v.object({
              color: v.pipe(
                v.string(),
                v.title('颜色 Color'),
                v.metadata({ propertyPanel: { editor: 'color' } }),
              ),
              width: v.pipe(
                v.number(),
                v.minValue(0),
                v.title('宽度 Width'),
                v.metadata({ propertyPanel: { unit: 'px' } }),
              ),
            }),
            v.title('描边 Stroke'),
          ),
        }),
        v.title('边框 Border'),
      ),
    }),
    v.title('属性层级 Property Demo'),
  ),
  layout: v.pipe(
    v.object({
      horizontalAlignment: v.pipe(
        v.picklist(['start', 'center', 'end', 'stretch']),
        v.title('水平对齐 Horizontal Alignment'),
        v.metadata({ propertyPanel: { editor: 'alignment' } }),
      ),
      verticalAlignment: v.pipe(
        v.picklist(['start', 'center', 'end', 'stretch']),
        v.title('垂直对齐 Vertical Alignment'),
        v.metadata({ propertyPanel: { editor: 'alignment' } }),
      ),
    }),
    v.title('Layout'),
  ),
  state: v.pipe(
    v.object({
      enabled: v.pipe(v.boolean(), v.title('交互状态 Is Enabled')),
      visibility: v.pipe(
        v.picklist(['visible', 'hidden']),
        v.title('可见性 Visibility'),
        v.metadata({ propertyPanel: { optionLabels: { visible: '◉ Visible', hidden: '○ Hidden' } } }),
      ),
    }),
    v.title('State'),
  ),
  advanced: v.pipe(
    v.object({ pixelSnapping: v.pipe(v.boolean(), v.title('像素吸附 Pixel Snapping')) }),
    v.title('Advanced'),
    v.metadata({ propertyPanel: { collapsed: true } }),
  ),
  diagnostics: v.pipe(
    v.object({ debugBounds: v.pipe(v.boolean(), v.title('调试边界 Debug Bounds')) }),
    v.title('Diagnostics'),
    v.metadata({ propertyPanel: { collapsed: true } }),
  ),
})

const DEFAULT_RECTANGLE_PROPERTIES: RectangleProperties = {
  transform: {
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    anchor: 'center',
    angle: 0,
    scale: { x: 1, y: 1 },
  },
  appearance: {
    color: '#3B82F6',
    opacity: 1,
    cornerRadius: 4,
  },
  propertyDemo: {
    border: { stroke: { color: '#3B82F6', width: 1 } },
  },
  layout: {
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
  },
  state: {
    enabled: true,
    visibility: 'visible',
  },
  advanced: { pixelSnapping: true },
  diagnostics: { debugBounds: false },
}

const echartRenderer = [{
  id: 'echart',
  component: EChartsOptionRenderer,
}] as const

const rectangleRenderers = [
  { id: 'vector2', component: AxisPairRenderer },
  { id: 'size2', component: SizePairRenderer },
  { id: 'color', component: ColorRenderer },
  { id: 'alignment', component: AlignmentRenderer },
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isEChartsOption(input: unknown): input is EChartsOption {
  if (!isRecord(input) || !Array.isArray(input.series) || input.series.length === 0) return false
  return input.series.every((series) => (
    isRecord(series)
    && ['bar', 'line', 'pie'].includes(String(series.type))
    && Array.isArray(series.data)
    && series.data.every((item) => (
      (typeof item === 'number' && Number.isFinite(item))
      || (isRecord(item) && typeof item.value === 'number' && Number.isFinite(item.value))
    ))
  ))
}

function createChartOption(config: DemoChartConfig): EChartsOption {
  const cartesian = config.type !== 'pie'
  return {
    animation: false,
    backgroundColor: 'transparent',
    title: {
      left: 'center',
      text: config.title,
      textStyle: { color: '#dce6f3', fontSize: 15 },
    },
    tooltip: {},
    legend: {
      bottom: 4,
      textStyle: { color: '#9ba8b8' },
    },
    grid: cartesian ? { left: 40, right: 18, top: 54, bottom: 42 } : undefined,
    xAxis: cartesian ? {
      type: 'category',
      data: config.data.map((_, index) => `Q${index + 1}`),
      axisLabel: { color: '#8290a2' },
      axisLine: { lineStyle: { color: '#46505d' } },
    } : undefined,
    yAxis: cartesian ? {
      type: 'value',
      axisLabel: { color: '#8290a2' },
      splitLine: { lineStyle: { color: '#29313b' } },
    } : undefined,
    series: config.type === 'pie' ? [{
      type: 'pie',
      name: config.seriesName,
      radius: ['35%', '65%'],
      data: config.data.map((item, index) => ({ name: `Q${index + 1}`, value: item })),
    }] : [{
      type: config.type,
      name: config.seriesName,
      data: config.data,
      itemStyle: { color: '#3b82f6' },
      lineStyle: { color: '#60a5fa' },
    }],
  }
}

function readChartConfig(option: unknown): DemoChartConfig {
  if (!isRecord(option)) return DEFAULT_CHART_CONFIG
  const titleOption = isRecord(option.title) ? option.title : {}
  const series = Array.isArray(option.series) && isRecord(option.series[0]) ? option.series[0] : {}
  const type = ['bar', 'line', 'pie'].includes(String(series.type))
    ? series.type as DemoChartType
    : DEFAULT_CHART_CONFIG.type
  const data = Array.isArray(series.data)
    ? series.data.map((item) => (
        typeof item === 'number'
          ? item
          : isRecord(item) && typeof item.value === 'number' ? item.value : Number.NaN
      )).filter(Number.isFinite)
    : DEFAULT_CHART_CONFIG.data
  return {
    title: typeof titleOption.text === 'string' ? titleOption.text : DEFAULT_CHART_CONFIG.title,
    type,
    seriesName: typeof series.name === 'string' ? series.name : DEFAULT_CHART_CONFIG.seriesName,
    data: data.length > 0 ? data : DEFAULT_CHART_CONFIG.data,
  }
}

function AxisPairRenderer({ value, readOnly, commit }: PropertyPanelRendererProps) {
  const pair = value as AxisPair
  return (
    <div className="compound-number-editor">
      <label>
        <span>X</span>
        <input
          aria-label="X"
          disabled={readOnly}
          type="number"
          value={pair.x}
          onChange={(event) => commit(
            { ...pair, x: Number(event.target.value) },
            'input',
          )}
        />
      </label>
      <label>
        <span>Y</span>
        <input
          aria-label="Y"
          disabled={readOnly}
          type="number"
          value={pair.y}
          onChange={(event) => commit(
            { ...pair, y: Number(event.target.value) },
            'input',
          )}
        />
      </label>
    </div>
  )
}

function SizePairRenderer({ value, readOnly, commit }: PropertyPanelRendererProps) {
  const pair = value as SizePair
  return (
    <div className="compound-number-editor">
      <label>
        <span>W</span>
        <input
          aria-label="W"
          disabled={readOnly}
          type="number"
          value={pair.width}
          onChange={(event) => commit(
            { ...pair, width: Number(event.target.value) },
            'input',
          )}
        />
      </label>
      <label>
        <span>H</span>
        <input
          aria-label="H"
          disabled={readOnly}
          type="number"
          value={pair.height}
          onChange={(event) => commit(
            { ...pair, height: Number(event.target.value) },
            'input',
          )}
        />
      </label>
    </div>
  )
}

function ColorRenderer({ value, readOnly, commit }: PropertyPanelRendererProps) {
  const color = typeof value === 'string' ? value : '#000000'
  return (
    <label className="color-property-editor">
      <input
        aria-label="颜色选择器"
        disabled={readOnly}
        type="color"
        value={color}
        onChange={(event) => commit(event.target.value.toUpperCase(), 'input')}
      />
      <input
        aria-label="颜色值"
        disabled={readOnly}
        value={color.toUpperCase()}
        onChange={(event) => {
          if (/^#[\dA-F]{6}$/iu.test(event.target.value)) {
            commit(event.target.value.toUpperCase(), 'input')
          }
        }}
      />
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <path d="m4 6 4 4 4-4" />
      </svg>
    </label>
  )
}

function AlignmentRenderer({ value, readOnly, commit }: PropertyPanelRendererProps) {
  const options = ['start', 'center', 'end', 'stretch'] as const
  return (
    <div className="alignment-property-editor">
      {options.map((option) => (
        <button
          aria-label={`对齐 ${option}`}
          aria-pressed={value === option}
          disabled={readOnly}
          key={option}
          type="button"
          onClick={() => commit(option)}
        >
          <span aria-hidden="true" data-alignment={option}>
            <i />
            <i />
            <i />
          </span>
        </button>
      ))}
    </div>
  )
}

function RectangleIcon() {
  return (
    <span className="rectangle-component-icon" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <rect height="30" width="30" x="9" y="9" />
      </svg>
    </span>
  )
}

function EChartsOptionRenderer({ value, readOnly, commit }: PropertyPanelRendererProps) {
  const config = readChartConfig(value)
  const update = (
    patch: Partial<DemoChartConfig>,
    reason: 'input' | 'commit' = 'input',
  ) => commit(createChartOption({ ...config, ...patch }), reason)
  const [dataDraft, setDataDraft] = useState({
    source: value,
    text: config.data.join(', '),
    error: '',
  })
  const dataDraftActive = Object.is(dataDraft.source, value)
  const dataText = dataDraftActive ? dataDraft.text : config.data.join(', ')
  const dataError = dataDraftActive ? dataDraft.error : ''
  return (
    <div className="echart-option-editor">
      <label>
        <span>标题</span>
        <input
          aria-label="图表标题"
          disabled={readOnly}
          value={config.title}
          onChange={(event) => update({ title: event.target.value })}
        />
      </label>
      <label>
        <span>类型</span>
        <select
          aria-label="图表类型"
          disabled={readOnly}
          value={config.type}
          onChange={(event) => update(
            { type: event.target.value as DemoChartType },
            'commit',
          )}
        >
          <option value="bar">柱状图</option>
          <option value="line">折线图</option>
          <option value="pie">饼图</option>
        </select>
      </label>
      <label>
        <span>系列</span>
        <input
          aria-label="系列名称"
          disabled={readOnly}
          value={config.seriesName}
          onChange={(event) => update({ seriesName: event.target.value })}
        />
      </label>
      <label>
        <span>数据</span>
        <input
          aria-invalid={dataError ? 'true' : undefined}
          aria-label="系列数据"
          disabled={readOnly}
          value={dataText}
          onChange={(event) => {
            const text = event.target.value
            const tokens = text.split(',').map((item) => item.trim())
            const data = tokens.map(Number)
            const valid = tokens.length > 0
              && tokens.every((token) => token !== '')
              && data.every(Number.isFinite)
            if (!valid) {
              setDataDraft({ source: value, text, error: '请输入逗号分隔的数字' })
              return
            }
            const success = update({ data })
            setDataDraft({
              source: value,
              text,
              error: success ? '' : 'EChartsOption 未通过 Schema 校验',
            })
          }}
        />
        {dataError ? <small role="alert">{dataError}</small> : null}
      </label>
      <EChartView accessible={false} option={value as EChartsOption} />
    </div>
  )
}

function EChartView({
  option,
  accessible,
}: {
  option: EChartsOption
  accessible: boolean
}) {
  const chartElementRef = useRef<HTMLDivElement>(null)
  const config = readChartConfig(option)
  useEffect(() => {
    const element = chartElementRef.current
    if (!element) return
    const chart = initECharts(element, 'dark', { renderer: 'canvas' })
    chart.setOption(option, true)
    const resize = () => chart.resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      chart.dispose()
    }
  }, [option])

  return (
    <div
      aria-hidden={accessible ? undefined : 'true'}
      aria-label={accessible ? `${config.title} ECharts 图表` : undefined}
      className={accessible ? 'echart-node' : 'echart-editor-preview'}
      role={accessible ? 'img' : undefined}
    >
      <div ref={chartElementRef} />
    </div>
  )
}

type MoveOperation = Extract<SceneTreeOperation, { type: 'move' }>

const dragFixtureNodes: readonly SceneTreeNode[] = [{
  id: 'page',
  label: 'Page 1',
  canMove: false,
  children: [
    {
      id: 'group-a',
      label: 'Group A',
      children: [
        { id: 'layer-1', label: 'Layer 1', canHaveChildren: false },
        { id: 'layer-2', label: 'Layer 2', canHaveChildren: false },
        { id: 'layer-3', label: 'Layer 3', canHaveChildren: false },
      ],
    },
    { id: 'group-b', label: 'Group B', children: [] },
    { id: 'loose', label: 'Loose', canHaveChildren: false },
  ],
}]

const defaultSceneNodes: readonly SceneTreeNode[] = [{
  id: 'page',
  label: 'Page 1',
  canMove: false,
  children: [],
}]

function applySceneMove(
  nodes: readonly SceneTreeNode[],
  operation: MoveOperation,
): readonly SceneTreeNode[] {
  const movingSet = new Set(operation.nodeIds)
  const removed = new Map<string, SceneTreeNode>()
  const locations = new Map<string, { parentId: string | null; index: number }>()

  const removeMovingNodes = (
    source: readonly SceneTreeNode[],
    parentId: string | null,
  ): readonly SceneTreeNode[] => source.flatMap((node, index) => {
    if (movingSet.has(node.id)) {
      removed.set(node.id, node)
      locations.set(node.id, { parentId, index })
      return []
    }
    if (!node.children) return [node]
    return [{ ...node, children: removeMovingNodes(node.children, node.id) }]
  })

  const remaining = removeMovingNodes(nodes, null)
  const movingNodes = operation.nodeIds
    .map((nodeId) => removed.get(nodeId))
    .filter((node): node is SceneTreeNode => Boolean(node))
  if (movingNodes.length !== operation.nodeIds.length) return nodes

  const removedBeforeTarget = operation.nodeIds.filter((nodeId) => {
    const location = locations.get(nodeId)
    return location?.parentId === operation.parentId && location.index < operation.index
  }).length
  const adjustedIndex = Math.max(0, operation.index - removedBeforeTarget)
  if (operation.parentId === null) {
    const result = [...remaining]
    result.splice(Math.min(adjustedIndex, result.length), 0, ...movingNodes)
    return result
  }

  let inserted = false
  const insertIntoParent = (source: readonly SceneTreeNode[]): readonly SceneTreeNode[] => (
    source.map((node) => {
      if (node.id === operation.parentId) {
        inserted = true
        const children = [...(node.children ?? [])]
        children.splice(Math.min(adjustedIndex, children.length), 0, ...movingNodes)
        return { ...node, children }
      }
      if (!node.children) return node
      return { ...node, children: insertIntoParent(node.children) }
    })
  )
  const result = insertIntoParent(remaining)
  return inserted ? result : nodes
}

function updateSceneNodeLabel(
  nodes: readonly SceneTreeNode[],
  nodeId: string,
  label: string,
): readonly SceneTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    label: node.id === nodeId ? label : node.label,
    children: node.children
      ? updateSceneNodeLabel(node.children, nodeId, label)
      : undefined,
  }))
}

function removeSceneNodes(
  nodes: readonly SceneTreeNode[],
  removedIds: ReadonlySet<string>,
): readonly SceneTreeNode[] {
  return nodes.flatMap((node) => (
    removedIds.has(node.id)
      ? []
      : [{
          ...node,
          children: node.children ? removeSceneNodes(node.children, removedIds) : undefined,
        }]
  ))
}

function insertSceneNode(
  nodes: readonly SceneTreeNode[],
  parentId: string,
  index: number | undefined,
  insertedNode: SceneTreeNode,
): readonly SceneTreeNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      const children = [...(node.children ?? [])]
      children.splice(Math.min(index ?? children.length, children.length), 0, insertedNode)
      return { ...node, children }
    }
    if (!node.children) return node
    return { ...node, children: insertSceneNode(node.children, parentId, index, insertedNode) }
  })
}

function insertSceneNodes(
  nodes: readonly SceneTreeNode[],
  parentId: string | null,
  index: number,
  insertedNodes: readonly SceneTreeNode[],
): readonly SceneTreeNode[] {
  if (parentId === null) {
    const result = [...nodes]
    result.splice(Math.min(index, result.length), 0, ...insertedNodes)
    return result
  }
  return nodes.map((node) => {
    if (node.id === parentId) {
      const children = [...(node.children ?? [])]
      children.splice(Math.min(index, children.length), 0, ...insertedNodes)
      return { ...node, children }
    }
    return node.children
      ? { ...node, children: insertSceneNodes(node.children, parentId, index, insertedNodes) }
      : node
  })
}

function findSceneNode(
  nodes: readonly SceneTreeNode[],
  nodeId: string,
): SceneTreeNode | null {
  const stack = [...nodes].reverse()
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    if (node.id === nodeId) return node
    if (node.children) stack.push(...[...node.children].reverse())
  }
  return null
}

function collectSceneSubtreeIds(
  nodes: readonly SceneTreeNode[],
  rootIds: readonly string[],
): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const rootId of rootIds) {
    const root = findSceneNode(nodes, rootId)
    if (!root) continue
    const stack = [root]
    while (stack.length > 0) {
      const node = stack.pop()
      if (!node || ids.has(node.id)) continue
      ids.add(node.id)
      if (node.children) stack.push(...node.children)
    }
  }
  return ids
}

function collectSceneNodeIds(nodes: readonly SceneTreeNode[]): readonly string[] {
  const ids: string[] = []
  const stack = [...nodes].reverse()
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    ids.push(node.id)
    if (node.children) stack.push(...[...node.children].reverse())
  }
  return ids
}

function propertyHistoryMergeKey(
  componentId: string,
  change: PropertyPanelChange,
): string | undefined {
  return change.reason === 'input'
    ? `${componentId}:${change.path.join('.')}`
    : undefined
}

function App() {
  const history = useHistory<DemoDocumentSnapshot>({
    textComponents: [],
    chartComponents: [],
    rectangleComponents: [],
    sceneNodes: defaultSceneNodes,
  })
  const {
    textComponents,
    chartComponents,
    rectangleComponents,
    sceneNodes: normalSceneNodes,
  } = history.value
  const [selectedSceneIds, setSelectedSceneIds] = useState<readonly string[]>(['page'])
  const [normalExpandedIds, setNormalExpandedIds] = useState<readonly string[]>(['page'])
  const [dragNodes, setDragNodes] = useState(dragFixtureNodes)
  const [dragSelectedIds, setDragSelectedIds] = useState<readonly string[]>([])
  const [dragExpandedIds, setDragExpandedIds] = useState<readonly string[]>(['page', 'group-a'])
  const [command, setCommand] = useState('')
  const nextTextIdRef = useRef(1)
  const nextChartIdRef = useRef(1)
  const nextRectangleIdRef = useRef(1)
  const normalSceneIdSet = useMemo(
    () => new Set(collectSceneNodeIds(normalSceneNodes)),
    [normalSceneNodes],
  )
  const validSelectedSceneIds = selectedSceneIds.filter(
    (nodeId) => normalSceneIdSet.has(nodeId),
  )
  const effectiveSelectedSceneIds = validSelectedSceneIds.length > 0
    ? validSelectedSceneIds
    : selectedSceneIds.length > 0 && normalSceneIdSet.has('page') ? ['page'] : []
  const effectiveExpandedIds = normalExpandedIds.filter(
    (nodeId) => normalSceneIdSet.has(nodeId),
  )

  const selectedText = [...effectiveSelectedSceneIds]
    .reverse()
    .map((nodeId) => textComponents.find(({ id }) => id === nodeId))
    .find((component): component is TextComponent => Boolean(component)) ?? null
  const selectedChart = [...effectiveSelectedSceneIds]
    .reverse()
    .map((nodeId) => chartComponents.find(({ id }) => id === nodeId))
    .find((component): component is ChartComponent => Boolean(component)) ?? null
  const selectedRectangle = [...effectiveSelectedSceneIds]
    .reverse()
    .map((nodeId) => rectangleComponents.find(({ id }) => id === nodeId))
    .find((component): component is RectangleComponent => Boolean(component)) ?? null

  const searchParams = new URLSearchParams(window.location.search)
  const sceneSize = Number(searchParams.get('sceneSize'))
  const useDragFixture = searchParams.get('sceneDrag') === '1'
  const sceneNodes = useMemo<readonly SceneTreeNode[]>(() => {
    if (useDragFixture) return dragNodes
    if (sceneSize === 5000) {
      return [{
        id: 'page',
        label: 'Page 1',
        children: Array.from({ length: 4999 }, (_, index) => ({
          id: `node-${index + 1}`,
          label: `Node ${index + 1}`,
        })),
      }]
    }
    return normalSceneNodes
  }, [dragNodes, normalSceneNodes, sceneSize, useDragFixture])

  const orderedTextComponents = useMemo(() => {
    const positions = new Map(
      collectSceneNodeIds(normalSceneNodes).map((nodeId, index) => [nodeId, index]),
    )
    return [...textComponents].sort(
      (left, right) => (positions.get(left.id) ?? Infinity) - (positions.get(right.id) ?? Infinity),
    )
  }, [normalSceneNodes, textComponents])

  const orderedChartComponents = useMemo(() => {
    const positions = new Map(
      collectSceneNodeIds(normalSceneNodes).map((nodeId, index) => [nodeId, index]),
    )
    return [...chartComponents].sort(
      (left, right) => (positions.get(left.id) ?? Infinity) - (positions.get(right.id) ?? Infinity),
    )
  }, [chartComponents, normalSceneNodes])

  const orderedRectangleComponents = useMemo(() => {
    const positions = new Map(
      collectSceneNodeIds(normalSceneNodes).map((nodeId, index) => [nodeId, index]),
    )
    return [...rectangleComponents].sort(
      (left, right) => (positions.get(left.id) ?? Infinity) - (positions.get(right.id) ?? Infinity),
    )
  }, [normalSceneNodes, rectangleComponents])

  const addTextComponent = (parentId: string | null = 'page', index?: number) => {
    const number = nextTextIdRef.current
    nextTextIdRef.current += 1
    const id = `text-${number}`
    const text = number === 1 ? '默认文本' : `默认文本 ${number}`
    const component: TextComponent = {
      id,
      text,
      defaultText: text,
      keywords: ['大屏', '现场'],
      defaultKeywords: ['大屏', '现场'],
    }
    history.commit((current) => ({
      ...current,
      textComponents: [...current.textComponents, component],
      sceneNodes: parentId === null
        ? insertSceneNodes(
            current.sceneNodes,
            null,
            index ?? current.sceneNodes.length,
            [{ id, label: text }],
          )
        : insertSceneNode(current.sceneNodes, parentId, index, { id, label: text }),
    }), { label: '新增文本组件' })
    if (parentId !== null) {
      setNormalExpandedIds((current) => current.includes(parentId)
        ? current
        : [...current, parentId])
    }
  }

  const addChartComponent = () => {
    const number = nextChartIdRef.current
    nextChartIdRef.current += 1
    const id = `chart-${number}`
    const option = createChartOption(DEFAULT_CHART_CONFIG)
    history.commit((current) => ({
      ...current,
      chartComponents: [...current.chartComponents, {
        id,
        option,
        defaultOption: createChartOption(DEFAULT_CHART_CONFIG),
      }],
      sceneNodes: insertSceneNode(current.sceneNodes, 'page', undefined, {
        id,
        label: number === 1 ? 'ECharts 图表' : `ECharts 图表 ${number}`,
        canHaveChildren: false,
      }),
    }), { label: '新增 ECharts 图表' })
    setNormalExpandedIds((current) => current.includes('page') ? current : [...current, 'page'])
    setSelectedSceneIds([id])
  }

  const addRectangleComponent = () => {
    const number = nextRectangleIdRef.current
    nextRectangleIdRef.current += 1
    const id = `rectangle-${number}`
    history.commit((current) => ({
      ...current,
      rectangleComponents: [...current.rectangleComponents, {
        id,
        properties: structuredClone(DEFAULT_RECTANGLE_PROPERTIES),
        defaultProperties: structuredClone(DEFAULT_RECTANGLE_PROPERTIES),
      }],
      sceneNodes: insertSceneNode(current.sceneNodes, 'page', undefined, {
        id,
        label: number === 1 ? 'Rectangle' : `Rectangle ${number}`,
        canHaveChildren: false,
      }),
    }), { label: '新增 Rectangle' })
    setNormalExpandedIds((current) => current.includes('page') ? current : [...current, 'page'])
    setSelectedSceneIds([id])
  }

  const updateTextComponent = (nodeId: string, text: string) => {
    history.commit((current) => ({
      ...current,
      textComponents: current.textComponents.map((component) => (
        component.id === nodeId ? { ...component, text } : component
      )),
      sceneNodes: updateSceneNodeLabel(current.sceneNodes, nodeId, text),
    }), { label: '重命名节点' })
  }

  const handleSceneOperation = (operation: SceneTreeOperation) => {
    if (useDragFixture && operation.type === 'move') {
      setDragNodes((current) => applySceneMove(current, operation))
      return
    }
    if (!useDragFixture && operation.type === 'move') {
      history.commit((current) => ({
        ...current,
        sceneNodes: applySceneMove(current.sceneNodes, operation),
      }), { label: operation.nodeIds.length > 1 ? '移动多个节点' : '移动节点' })
      const parentId = operation.parentId
      if (parentId) {
        setNormalExpandedIds((current) => current.includes(parentId)
          ? current
          : [...current, parentId])
      }
      return
    }
    if (!useDragFixture && operation.type === 'duplicate') {
      const duplicatedTextComponents: TextComponent[] = []
      const duplicatedChartComponents: ChartComponent[] = []
      const duplicatedRectangleComponents: RectangleComponent[] = []
      const duplicatedIds: string[] = []
      const cloneNode = (source: SceneTreeNode): SceneTreeNode => {
        const sourceChart = chartComponents.find((component) => component.id === source.id)
        const sourceText = textComponents.find((component) => component.id === source.id)
        const sourceRectangle = rectangleComponents.find((component) => component.id === source.id)
        const id = sourceChart
          ? `chart-${nextChartIdRef.current++}`
          : sourceRectangle
            ? `rectangle-${nextRectangleIdRef.current++}`
            : `text-${nextTextIdRef.current++}`
        duplicatedIds.push(id)
        if (sourceText) duplicatedTextComponents.push({
          id,
          text: sourceText.text,
          defaultText: sourceText.defaultText,
          keywords: [...sourceText.keywords],
          defaultKeywords: [...sourceText.defaultKeywords],
        })
        if (sourceChart) duplicatedChartComponents.push({
          id,
          option: structuredClone(sourceChart.option),
          defaultOption: structuredClone(sourceChart.defaultOption),
        })
        if (sourceRectangle) duplicatedRectangleComponents.push({
          id,
          properties: structuredClone(sourceRectangle.properties),
          defaultProperties: structuredClone(sourceRectangle.defaultProperties),
        })
        return {
          ...source,
          id,
          children: source.children?.map(cloneNode),
        }
      }
      const copies = operation.sourceNodeIds
        .map((nodeId) => findSceneNode(normalSceneNodes, nodeId))
        .filter((node): node is SceneTreeNode => Boolean(node))
        .map(cloneNode)
      if (copies.length !== operation.sourceNodeIds.length) return
      history.commit((current) => ({
        ...current,
        sceneNodes: insertSceneNodes(
          current.sceneNodes,
          operation.parentId,
          operation.index,
          copies,
        ),
        textComponents: [...current.textComponents, ...duplicatedTextComponents],
        chartComponents: [...current.chartComponents, ...duplicatedChartComponents],
        rectangleComponents: [
          ...current.rectangleComponents,
          ...duplicatedRectangleComponents,
        ],
      }), {
        label: operation.sourceNodeIds.length > 1 ? '复制多个节点' : '复制节点',
      })
      setSelectedSceneIds(duplicatedIds)
      if (operation.parentId) {
        setNormalExpandedIds((current) => current.includes(operation.parentId!)
          ? current
          : [...current, operation.parentId!])
      }
      return
    }
    if (operation.type === 'create') {
      addTextComponent(operation.parentId, operation.index)
    }
    if (operation.type === 'rename') {
      updateTextComponent(operation.nodeId, operation.label)
    }
    if (operation.type === 'delete') {
      const deletedIds = collectSceneSubtreeIds(normalSceneNodes, operation.nodeIds)
      history.commit((current) => ({
        ...current,
        textComponents: current.textComponents.filter(({ id }) => !deletedIds.has(id)),
        chartComponents: current.chartComponents.filter(({ id }) => !deletedIds.has(id)),
        rectangleComponents: current.rectangleComponents.filter(
          ({ id }) => !deletedIds.has(id),
        ),
        sceneNodes: removeSceneNodes(current.sceneNodes, deletedIds),
      }), { label: operation.nodeIds.length > 1 ? '删除多个节点' : '删除节点' })
      setSelectedSceneIds((current) => {
        const remaining = current.filter((nodeId) => !deletedIds.has(nodeId))
        if (remaining.length > 0 || deletedIds.has('page')) return remaining
        return ['page']
      })
      setNormalExpandedIds((current) => current.filter((nodeId) => !deletedIds.has(nodeId)))
    }
  }

  return (
    <ComposeEditor
      className="editor-workspace"
      history={history}
      sceneTreeProps={{
        nodes: sceneNodes,
        selectedIds: useDragFixture ? dragSelectedIds : effectiveSelectedSceneIds,
        expandedIds: useDragFixture ? dragExpandedIds : effectiveExpandedIds,
        onSelectionChange: (nodeIds) => {
          if (useDragFixture) {
            setDragSelectedIds(nodeIds)
            return
          }
          setSelectedSceneIds(nodeIds)
        },
        onExpandedChange: (nodeIds) => {
          if (useDragFixture) {
            setDragExpandedIds(nodeIds)
            return
          }
          setNormalExpandedIds(nodeIds)
        },
        onOperation: handleSceneOperation,
      }}
          canvasToolbar={
            <div className="canvas-tools">
              <button className="tool-button is-active" type="button">
                选择
              </button>
              <button className="tool-button" type="button">
                平移
              </button>
              <span className="tool-divider" />
              <button
                className="add-button add-button--rectangle"
                type="button"
                onClick={addRectangleComponent}
              >
                添加矩形组件
              </button>
              <button
                className="add-button"
                type="button"
                onClick={() => addTextComponent()}
              >
                添加文本组件
              </button>
              <button
                className="add-button add-button--chart"
                type="button"
                onClick={addChartComponent}
              >
                添加 ECharts 图表
              </button>
              <span className="zoom-value">100%</span>
            </div>
          }
          inspectorPanel={
            <div className="inspector-panel">
              {selectedText ? (
                <PropertyPanel
                  aria-label="文本组件属性"
                  defaultValue={{ content: {
                    text: selectedText.defaultText,
                    keywords: selectedText.defaultKeywords,
                  } }}
                  header={{
                    icon: <span className="node-icon">T</span>,
                    title: selectedText.text,
                    subtitle: '文本组件',
                  }}
                  schema={textPropertySchema}
                  value={{ content: {
                    text: selectedText.text,
                    keywords: selectedText.keywords,
                  } }}
                  onValueChange={(nextValue, change) => {
                    history.commit((current) => ({
                      ...current,
                      textComponents: current.textComponents.map((component) => (
                        component.id === selectedText.id
                          ? {
                              ...component,
                              text: nextValue.content.text,
                              keywords: nextValue.content.keywords,
                            }
                          : component
                      )),
                      sceneNodes: updateSceneNodeLabel(
                        current.sceneNodes,
                        selectedText.id,
                        nextValue.content.text,
                      ),
                    }), {
                      label: change.path.includes('text')
                        ? '修改文本内容'
                        : '修改文本属性',
                      mergeKey: propertyHistoryMergeKey(selectedText.id, change),
                    })
                  }}
                />
              ) : selectedRectangle ? (
                <PropertyPanel
                  aria-label="Rectangle 属性"
                  defaultValue={selectedRectangle.defaultProperties}
                  header={{
                    icon: <RectangleIcon />,
                    title: 'Rectangle',
                    subtitle: '基础节点',
                  }}
                  renderers={rectangleRenderers}
                  schema={rectanglePropertySchema}
                  value={selectedRectangle.properties}
                  onValueChange={(nextValue, change) => {
                    history.commit((current) => ({
                      ...current,
                      rectangleComponents: current.rectangleComponents.map((component) => (
                        component.id === selectedRectangle.id
                          ? { ...component, properties: nextValue }
                          : component
                      )),
                    }), {
                      label: '修改 Rectangle 属性',
                      mergeKey: propertyHistoryMergeKey(selectedRectangle.id, change),
                    })
                  }}
                />
              ) : selectedChart ? (
                <PropertyPanel
                  aria-label="ECharts 图表属性"
                  defaultValue={{ chart: { option: selectedChart.defaultOption } }}
                  header={{
                    icon: <span className="node-icon node-icon--chart">E</span>,
                    title: readChartConfig(selectedChart.option).title,
                    subtitle: 'ECharts 图表组件',
                  }}
                  renderers={echartRenderer}
                  schema={chartPropertySchema}
                  value={{ chart: { option: selectedChart.option } }}
                  onValueChange={(nextValue, change) => {
                    history.commit((current) => ({
                      ...current,
                      chartComponents: current.chartComponents.map((component) => (
                        component.id === selectedChart.id
                          ? { ...component, option: nextValue.chart.option }
                          : component
                      )),
                    }), {
                      label: '修改 ECharts 配置',
                      mergeKey: propertyHistoryMergeKey(selectedChart.id, change),
                    })
                  }}
                />
              ) : (
                <p className="empty-message">选择画布中的组件以编辑属性</p>
              )}
            </div>
          }
          transactionLogPanel={
            <ol className="transaction-list">
              <li>
                <span>workspace.ready</span>
                <time>当前会话</time>
              </li>
              {textComponents.map((component) => (
                <li key={component.id}>
                  <span>component.text.update</span>
                  <time>{component.text}</time>
                </li>
              ))}
              {chartComponents.map((component) => (
                <li key={component.id}>
                  <span>component.echart.update</span>
                  <time>{readChartConfig(component.option).title}</time>
                </li>
              ))}
              {rectangleComponents.map((component) => (
                <li key={component.id}>
                  <span>component.rectangle.update</span>
                  <time>Rectangle</time>
                </li>
              ))}
            </ol>
          }
          commandPanel={
            <form className="command-form" onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="workspace-command">输入编辑器命令</label>
              <div>
                <span aria-hidden="true">›</span>
                <input
                  id="workspace-command"
                  value={command}
                  placeholder="例如：add text"
                  onChange={(event) => setCommand(event.target.value)}
                />
              </div>
            </form>
          }
        >
          <section aria-label="编辑画布" className="editor-canvas">
            <div className="canvas-grid" aria-hidden="true" />
            {orderedTextComponents.length === 0
              && orderedChartComponents.length === 0
              && orderedRectangleComponents.length === 0 ? (
              <span className="canvas-empty">点击工具栏按钮添加组件</span>
            ) : (
              <div className="canvas-components">
                {orderedTextComponents.map((component) => (
                  <button
                    className="text-node"
                    key={component.id}
                    type="button"
                    onClick={() => setSelectedSceneIds([component.id])}
                  >
                    {component.text}
                  </button>
                ))}
                {orderedChartComponents.map((component) => (
                  <button
                    aria-label={`选择 ${readChartConfig(component.option).title}`}
                    className="chart-node-button"
                    key={component.id}
                    type="button"
                    onClick={() => setSelectedSceneIds([component.id])}
                  >
                    <EChartView accessible option={component.option} />
                  </button>
                ))}
                {orderedRectangleComponents.map((component) => {
                  const { transform, appearance, propertyDemo, state } = component.properties
                  return (
                    <button
                      aria-label="选择 Rectangle"
                      className="rectangle-node"
                      key={component.id}
                      type="button"
                      style={{
                        width: transform.size.width,
                        height: transform.size.height,
                        borderColor: propertyDemo.border.stroke.color,
                        borderRadius: appearance.cornerRadius,
                        borderWidth: propertyDemo.border.stroke.width,
                        backgroundColor: appearance.color,
                        opacity: state.visibility === 'visible' ? appearance.opacity : 0.16,
                        transform: `translate(${transform.position.x}px, ${transform.position.y}px) rotate(${transform.angle}deg) scale(${transform.scale.x}, ${transform.scale.y})`,
                      }}
                      onClick={() => setSelectedSceneIds([component.id])}
                    >
                      <span>Rectangle</span>
                    </button>
                  )
                })}
              </div>
            )}
        </section>
    </ComposeEditor>
  )
}

export default App
