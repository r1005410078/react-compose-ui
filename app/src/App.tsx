import { ComposeEditor } from '@compose-ui/editor'
import { useHistory } from '@compose-ui/history'
import {
  OperationLogPanel,
  OperationLogProvider,
  useOperationLog,
} from '@compose-ui/operation-log'
import {
  PropertyPanel,
  resolvePropertyBindings,
} from '@compose-ui/property-panel'
import type {
  PropertyPanelBinding,
  PropertyPanelChange,
  PropertyPanelRenderer,
  PropertyPanelRendererProps,
  PropertyPanelVariable,
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
import type { ReactNode } from 'react'
import * as v from 'valibot'
import '@compose-ui/property-panel/styles.css'
import '@compose-ui/operation-log/styles.css'
import './App.css'

interface TextComponent {
  id: string
  text: string
  defaultText: string
  keywords: string[]
  defaultKeywords: string[]
  bindings: readonly PropertyPanelBinding[]
}

interface ChartComponent {
  id: string
  option: EChartsOption
  defaultOption: EChartsOption
  bindings: readonly PropertyPanelBinding[]
}

interface AxisPair {
  x: number
  y: number
}

interface SizePair {
  width: number
  height: number
}

enum DemoPriority {
  Normal = 'normal',
  High = 'high',
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
  supportedTypes: {
    primitives: {
      stringValue: string
      numberValue: number
      bigintValue: bigint
      booleanValue: boolean
      dateValue: Date
      literalValue: 'rectangle'
      picklistValue: 'draft' | 'published'
      enumValue: DemoPriority
    }
    presence: {
      optionalText?: string
      nullableText: string | null
      nullishText?: string | null
    }
    collections: {
      arrayValue: string[]
      tupleValue: [string, number]
      tupleRestValue: [string, ...number[]]
      recordValue: Record<string, number>
    }
    unions: {
      unionValue:
        | { kind: 'static'; value: string }
        | { kind: 'dynamic'; speed: number }
      variantValue:
        | { type: 'bar'; gap: number }
        | { type: 'line'; smooth: boolean }
    }
    custom: {
      chartOption: EChartsOption
    }
  }
}

interface RectangleComponent {
  id: string
  properties: RectangleProperties
  defaultProperties: RectangleProperties
  bindings: readonly PropertyPanelBinding[]
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

const DEMO_VARIABLES: readonly PropertyPanelVariable[] = [
  {
    id: 'page.positionX',
    label: '页面偏移 X',
    scope: 'page',
    value: 24,
    semanticScopes: ['position-x'],
  },
  {
    id: 'page.opacity',
    label: '页面透明度',
    scope: 'page',
    value: 0.65,
    semanticScopes: ['opacity'],
  },
  {
    id: 'page.accentColor',
    label: '页面强调色',
    scope: 'page',
    value: '#22C55E',
    semanticScopes: ['color'],
  },
  {
    id: 'page.heading',
    label: '页面标题',
    scope: 'page',
    value: '变量驱动标题',
  },
  {
    id: 'global.chartTitle',
    label: '全局图表标题',
    scope: 'global',
    value: '全局季度销售额',
    semanticScopes: ['chart-title'],
  },
  {
    id: 'global.chartType',
    label: '全局图表类型',
    scope: 'global',
    value: 'line',
    semanticScopes: ['chart-type'],
  },
  {
    id: 'global.seriesName',
    label: '全局系列名称',
    scope: 'global',
    value: '变量销售额',
    semanticScopes: ['chart-series'],
  },
  {
    id: 'global.chartData',
    label: '全局图表数据',
    scope: 'global',
    value: [18, 30, 22, 42],
    semanticScopes: ['chart-data'],
  },
]

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
        v.metadata({ propertyPanel: { editor: 'echart', binding: { enabled: true } } }),
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
        v.metadata({ propertyPanel: { editor: 'vector2', binding: { enabled: true } } }),
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
        v.metadata({ propertyPanel: { editor: 'angle', unit: '°' } }),
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
        v.metadata({ propertyPanel: { editor: 'color', binding: { enabled: true } } }),
      ),
      opacity: v.pipe(
        v.number(),
        v.minValue(0),
        v.maxValue(1),
        v.title('不透明度 Opacity'),
        v.metadata({ propertyPanel: { editor: 'opacity', binding: { enabled: true } } }),
      ),
      cornerRadius: v.pipe(
        v.number(),
        v.minValue(0),
        v.title('圆角 Corner Radius'),
        v.metadata({ propertyPanel: { editor: 'corner-radius' } }),
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
                v.metadata({ propertyPanel: { editor: 'stroke-width', unit: 'px' } }),
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
        v.metadata({ propertyPanel: {
          editor: 'visibility',
          optionLabels: { visible: 'Visible', hidden: 'Hidden' },
        } }),
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
  supportedTypes: v.pipe(
    v.object({
      primitives: v.pipe(
        v.object({
          stringValue: v.pipe(v.string(), v.title('字符串 String')),
          numberValue: v.pipe(v.number(), v.title('数字 Number')),
          bigintValue: v.pipe(v.bigint(), v.title('大整数 BigInt')),
          booleanValue: v.pipe(v.boolean(), v.title('布尔值 Boolean')),
          dateValue: v.pipe(v.date(), v.title('日期 Date')),
          literalValue: v.pipe(v.literal('rectangle'), v.title('固定值 Literal')),
          picklistValue: v.pipe(
            v.picklist(['draft', 'published']),
            v.title('选择 Picklist'),
            v.metadata({ propertyPanel: { optionLabels: {
              draft: '草稿 Draft',
              published: '已发布 Published',
            } } }),
          ),
          enumValue: v.pipe(
            v.enum(DemoPriority),
            v.title('枚举 Enum'),
            v.metadata({ propertyPanel: { optionLabels: {
              [DemoPriority.Normal]: '普通 Normal',
              [DemoPriority.High]: '高 High',
            } } }),
          ),
        }),
        v.title('基础类型 Primitives'),
        v.metadata({ propertyPanel: { collapsed: true } }),
      ),
      presence: v.pipe(
        v.object({
          optionalText: v.pipe(v.optional(v.string()), v.title('可选文本 Optional')),
          nullableText: v.pipe(v.nullable(v.string()), v.title('可空文本 Nullable')),
          nullishText: v.pipe(v.nullish(v.string()), v.title('空值文本 Nullish')),
        }),
        v.title('存在性包装 Presence'),
        v.metadata({ propertyPanel: { collapsed: true } }),
      ),
      collections: v.pipe(
        v.object({
          arrayValue: v.pipe(
            v.array(v.string()),
            v.title('列表 Array'),
            v.metadata({ propertyPanel: { collapsed: true } }),
          ),
          tupleValue: v.pipe(
            v.tuple([v.string(), v.number()]),
            v.title('元组 Tuple'),
            v.metadata({ propertyPanel: { collapsed: true } }),
          ),
          tupleRestValue: v.pipe(
            v.tupleWithRest([v.string()], v.number()),
            v.title('可变元组 Tuple Rest'),
            v.metadata({ propertyPanel: { collapsed: true } }),
          ),
          recordValue: v.pipe(
            v.record(v.string(), v.number()),
            v.title('记录 Record'),
            v.metadata({ propertyPanel: { collapsed: true } }),
          ),
        }),
        v.title('集合结构 Collections'),
        v.metadata({ propertyPanel: { collapsed: true } }),
      ),
      unions: v.pipe(
        v.object({
          unionValue: v.pipe(
            v.union([
              v.pipe(
                v.object({ kind: v.literal('static'), value: v.string() }),
                v.title('静态 Static'),
              ),
              v.pipe(
                v.object({ kind: v.literal('dynamic'), speed: v.number() }),
                v.title('动态 Dynamic'),
              ),
            ]),
            v.title('联合 Union'),
            v.metadata({ propertyPanel: { collapsed: true } }),
          ),
          variantValue: v.pipe(
            v.variant('type', [
              v.pipe(
                v.object({ type: v.literal('bar'), gap: v.number() }),
                v.title('柱状图 Bar'),
              ),
              v.pipe(
                v.object({ type: v.literal('line'), smooth: v.boolean() }),
                v.title('折线图 Line'),
              ),
            ]),
            v.title('变体 Variant'),
            v.metadata({ propertyPanel: { collapsed: true } }),
          ),
        }),
        v.title('联合结构 Unions'),
        v.metadata({ propertyPanel: { collapsed: true } }),
      ),
      custom: v.pipe(
        v.object({
          chartOption: v.pipe(
            v.custom<EChartsOption>(isEChartsOption, '请输入有效的 EChartsOption'),
            v.title('图表配置 EChartsOption'),
            v.metadata({ propertyPanel: { editor: 'echart' } }),
          ),
        }),
        v.title('自定义类型 Custom'),
        v.metadata({ propertyPanel: { collapsed: true } }),
      ),
    }),
    v.title('支持类型 Supported Types'),
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
  supportedTypes: {
    primitives: {
      stringValue: 'Rectangle',
      numberValue: 42,
      bigintValue: 9007199254740991n,
      booleanValue: true,
      dateValue: new Date('2026-07-21T00:00:00.000Z'),
      literalValue: 'rectangle',
      picklistValue: 'draft',
      enumValue: DemoPriority.Normal,
    },
    presence: {
      nullableText: null,
    },
    collections: {
      arrayValue: ['alpha', 'beta'],
      tupleValue: ['origin', 0],
      tupleRestValue: ['range', 10, 20],
      recordValue: { width: 100, height: 100 },
    },
    unions: {
      unionValue: { kind: 'static', value: 'ready' },
      variantValue: { type: 'bar', gap: 4 },
    },
    custom: {
      chartOption: createChartOption({
        ...DEFAULT_CHART_CONFIG,
        title: '类型示例图表',
      }),
    },
  },
}

const chartDataBindingSchema = v.pipe(v.array(v.number()), v.minLength(1))

const echartRenderer = [{
  id: 'echart',
  component: EChartsOptionRenderer,
  layout: 'full-width',
  bindingTargets: () => [
    {
      id: 'title',
      label: '图表标题',
      schema: v.string(),
      semanticScope: 'chart-title',
      getValue: (value: unknown) => readChartConfig(value).title,
      setValue: (value: unknown, targetValue: unknown) => createChartOption({
        ...readChartConfig(value),
        title: targetValue as string,
      }),
    },
    {
      id: 'type',
      label: '图表类型',
      schema: v.picklist(['bar', 'line', 'pie']),
      semanticScope: 'chart-type',
      getValue: (value: unknown) => readChartConfig(value).type,
      setValue: (value: unknown, targetValue: unknown) => createChartOption({
        ...readChartConfig(value),
        type: targetValue as DemoChartType,
      }),
    },
    {
      id: 'seriesName',
      label: '系列名称',
      schema: v.string(),
      semanticScope: 'chart-series',
      getValue: (value: unknown) => readChartConfig(value).seriesName,
      setValue: (value: unknown, targetValue: unknown) => createChartOption({
        ...readChartConfig(value),
        seriesName: targetValue as string,
      }),
    },
    {
      id: 'data',
      label: '系列数据',
      schema: chartDataBindingSchema,
      semanticScope: 'chart-data',
      getValue: (value: unknown) => readChartConfig(value).data,
      setValue: (value: unknown, targetValue: unknown) => createChartOption({
        ...readChartConfig(value),
        data: targetValue as number[],
      }),
    },
  ],
}] satisfies readonly PropertyPanelRenderer[]

const rectangleRenderers = [
  ...echartRenderer,
  {
    id: 'vector2',
    component: AxisPairRenderer,
    bindingTargets: ({ path }) => [
      {
        id: 'x', label: 'X', schema: v.number(),
        semanticScope: path[path.length - 1] === 'position' ? 'position-x' : undefined,
        getValue: (value: unknown) => (value as AxisPair).x,
        setValue: (value: unknown, targetValue: unknown) => ({
          ...(value as AxisPair), x: targetValue as number,
        }),
      },
      {
        id: 'y', label: 'Y', schema: v.number(),
        getValue: (value: unknown) => (value as AxisPair).y,
        setValue: (value: unknown, targetValue: unknown) => ({
          ...(value as AxisPair), y: targetValue as number,
        }),
      },
    ],
  },
  {
    id: 'size2',
    component: SizePairRenderer,
    bindingTargets: () => [
      {
        id: 'width', label: 'W', schema: v.number(),
        getValue: (value: unknown) => (value as SizePair).width,
        setValue: (value: unknown, targetValue: unknown) => ({
          ...(value as SizePair), width: targetValue as number,
        }),
      },
      {
        id: 'height', label: 'H', schema: v.number(),
        getValue: (value: unknown) => (value as SizePair).height,
        setValue: (value: unknown, targetValue: unknown) => ({
          ...(value as SizePair), height: targetValue as number,
        }),
      },
    ],
  },
  createScalarRenderer('angle', AngleRenderer, '旋转 Angle'),
  createScalarRenderer('opacity', OpacityRenderer, '不透明度 Opacity', 'opacity'),
  createScalarRenderer('corner-radius', CornerRadiusRenderer, '圆角 Corner Radius'),
  createScalarRenderer('stroke-width', StrokeWidthRenderer, '宽度 Width'),
  {
    id: 'visibility',
    component: VisibilityRenderer,
    bindingTargets: () => [createValueBindingTarget(
      '可见性 Visibility',
      v.picklist(['visible', 'hidden']),
    )],
  },
  {
    id: 'color',
    component: ColorRenderer,
    bindingTargets: () => [createValueBindingTarget('颜色 Color', v.string(), 'color')],
  },
  {
    id: 'alignment',
    component: AlignmentRenderer,
    bindingTargets: () => [createValueBindingTarget(
      '对齐',
      v.picklist(['start', 'center', 'end', 'stretch']),
    )],
  },
] satisfies readonly PropertyPanelRenderer[]

function createValueBindingTarget(
  label: string,
  schema: v.GenericSchema,
  semanticScope?: string,
) {
  return {
    id: 'value',
    label,
    schema,
    semanticScope,
    getValue: (value: unknown) => value,
    setValue: (_value: unknown, targetValue: unknown) => targetValue,
  }
}

function createScalarRenderer(
  id: string,
  component: PropertyPanelRenderer['component'],
  label: string,
  semanticScope?: string,
): PropertyPanelRenderer {
  return {
    id,
    component,
    bindingTargets: () => [createValueBindingTarget(label, v.number(), semanticScope)],
  }
}

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

function BindingTargetLayout({
  children,
  trigger,
}: {
  children: ReactNode
  trigger?: ReactNode
}) {
  if (!trigger) return <>{children}</>
  return (
    <span className="property-panel__binding-target">
      <span className="property-panel__binding-control">{children}</span>
      {trigger}
    </span>
  )
}

function BindingTargetBlock({
  children,
  trigger,
}: {
  children: ReactNode
  trigger?: ReactNode
}) {
  if (!trigger) return <>{children}</>
  return (
    <div className="property-panel__binding-target">
      <div className="property-panel__binding-control">{children}</div>
      {trigger}
    </div>
  )
}

function FixedNumberInput({
  label,
  value,
  precision,
  readOnly,
  disabled = false,
  bindingTrigger,
  unit,
  onCommit,
}: {
  label: string
  value: number
  precision: number
  readOnly: boolean
  disabled?: boolean
  bindingTrigger?: ReactNode
  unit?: string
  onCommit: (value: number) => boolean
}) {
  const format = (candidate: number) => candidate.toFixed(precision)
  const [draft, setDraft] = useState({ source: value, text: format(value), error: '' })
  const active = Object.is(draft.source, value)
  const text = active ? draft.text : format(value)
  const error = active ? draft.error : ''
  const submit = () => {
    if (readOnly) return
    const candidate = Number(text)
    const success = Number.isFinite(candidate) && onCommit(candidate)
    setDraft({
      source: success ? candidate : value,
      text: success ? format(candidate) : text,
      error: success ? '' : '完整属性值不符合 Schema',
    })
  }
  return (
    <BindingTargetLayout trigger={bindingTrigger}>
      <input
        aria-invalid={error ? 'true' : undefined}
        aria-label={label}
        disabled={disabled}
        inputMode="decimal"
        readOnly={readOnly}
        type="number"
        value={text}
        onBlur={submit}
        onChange={(event) => {
          if (!readOnly) setDraft({ source: value, text: event.target.value, error: '' })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
          if (event.key === 'Escape') {
            setDraft({ source: value, text: format(value), error: '' })
          }
        }}
      />
      {unit ? <span aria-hidden="true" className="scalar-number-unit">{unit}</span> : null}
      {error ? <small className="numeric-draft-error" role="alert">{error}</small> : null}
    </BindingTargetLayout>
  )
}

function AxisPairRenderer({ value, readOnly, commit, binding }: PropertyPanelRendererProps) {
  const pair = value as AxisPair
  const xTarget = binding?.getTarget('x')
  const yTarget = binding?.getTarget('y')
  return (
    <div className="compound-number-editor">
      <label>
        <span>X</span>
        <FixedNumberInput
          label="X"
          onCommit={(nextValue) => commit({ ...pair, x: nextValue })}
          precision={1}
          disabled={readOnly && !xTarget?.binding}
          bindingTrigger={binding?.renderTrigger('x')}
          readOnly={readOnly || Boolean(xTarget?.binding)}
          value={typeof xTarget?.effectiveValue === 'number' ? xTarget.effectiveValue : pair.x}
        />
      </label>
      <label>
        <span>Y</span>
        <FixedNumberInput
          label="Y"
          onCommit={(nextValue) => commit({ ...pair, y: nextValue })}
          precision={1}
          disabled={readOnly && !yTarget?.binding}
          bindingTrigger={binding?.renderTrigger('y')}
          readOnly={readOnly || Boolean(yTarget?.binding)}
          value={typeof yTarget?.effectiveValue === 'number' ? yTarget.effectiveValue : pair.y}
        />
      </label>
    </div>
  )
}

function SizePairRenderer({ value, readOnly, commit, binding }: PropertyPanelRendererProps) {
  const pair = value as SizePair
  const widthTarget = binding?.getTarget('width')
  const heightTarget = binding?.getTarget('height')
  return (
    <div className="compound-number-editor">
      <label>
        <span>W</span>
        <FixedNumberInput
          label="W"
          onCommit={(nextValue) => commit({ ...pair, width: nextValue })}
          precision={1}
          disabled={readOnly && !widthTarget?.binding}
          bindingTrigger={binding?.renderTrigger('width')}
          readOnly={readOnly || Boolean(widthTarget?.binding)}
          value={typeof widthTarget?.effectiveValue === 'number'
            ? widthTarget.effectiveValue
            : pair.width}
        />
      </label>
      <label>
        <span>H</span>
        <FixedNumberInput
          label="H"
          onCommit={(nextValue) => commit({ ...pair, height: nextValue })}
          precision={1}
          disabled={readOnly && !heightTarget?.binding}
          bindingTrigger={binding?.renderTrigger('height')}
          readOnly={readOnly || Boolean(heightTarget?.binding)}
          value={typeof heightTarget?.effectiveValue === 'number'
            ? heightTarget.effectiveValue
            : pair.height}
        />
      </label>
    </div>
  )
}

function ScalarNumberRenderer({
  ariaLabel,
  precision,
  unit,
  props,
}: {
  ariaLabel: string
  precision: number
  unit?: string
  props: PropertyPanelRendererProps
}) {
  const target = props.binding?.getTarget('value')
  const value = typeof target?.effectiveValue === 'number'
    ? target.effectiveValue
    : typeof props.value === 'number' ? props.value : 0
  return (
    <div className="scalar-number-editor">
      <FixedNumberInput
        label={ariaLabel}
        onCommit={(nextValue) => props.commit(nextValue)}
        precision={precision}
        disabled={props.readOnly && !target?.binding}
        bindingTrigger={props.binding?.renderTrigger('value')}
        readOnly={props.readOnly || Boolean(target?.binding)}
        unit={unit}
        value={value}
      />
    </div>
  )
}

function AngleRenderer(props: PropertyPanelRendererProps) {
  return <ScalarNumberRenderer ariaLabel="旋转 Angle" precision={1} props={props} unit="°" />
}

function OpacityRenderer(props: PropertyPanelRendererProps) {
  return <ScalarNumberRenderer ariaLabel="不透明度 Opacity" precision={1} props={props} />
}

function CornerRadiusRenderer(props: PropertyPanelRendererProps) {
  return <ScalarNumberRenderer ariaLabel="圆角 Corner Radius" precision={1} props={props} />
}

function StrokeWidthRenderer(props: PropertyPanelRendererProps) {
  return <ScalarNumberRenderer ariaLabel="宽度 Width" precision={0} props={props} unit="px" />
}

function ColorRenderer({ value, readOnly, commit, binding }: PropertyPanelRendererProps) {
  const target = binding?.getTarget('value')
  const color = typeof target?.effectiveValue === 'string'
    ? target.effectiveValue
    : typeof value === 'string' ? value : '#000000'
  const bound = Boolean(target?.binding)
  return (
    <BindingTargetBlock trigger={binding?.renderTrigger('value')}>
      <label className="color-property-editor">
        <input
          aria-label="颜色选择器"
          aria-readonly={bound ? 'true' : undefined}
          disabled={readOnly && !bound}
          type="color"
          value={color}
          onChange={(event) => {
            if (!bound) commit(event.target.value.toUpperCase())
          }}
        />
        <input
          aria-label="颜色值"
          disabled={readOnly && !bound}
          readOnly={bound}
          value={color.toUpperCase()}
          onChange={(event) => {
            if (!bound && /^#[\dA-F]{6}$/iu.test(event.target.value)) {
              commit(event.target.value.toUpperCase())
            }
          }}
        />
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </label>
    </BindingTargetBlock>
  )
}

function VisibilityRenderer({ value, readOnly, commit, binding }: PropertyPanelRendererProps) {
  const target = binding?.getTarget('value')
  const displayValue = target?.effectiveValue ?? value
  const bound = Boolean(target?.binding)
  return (
    <BindingTargetBlock trigger={binding?.renderTrigger('value')}>
      <label className="visibility-property-editor">
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="M1.8 10s3-5 8.2-5 8.2 5 8.2 5-3 5-8.2 5-8.2-5-8.2-5Z" />
          <circle cx="10" cy="10" r="2.4" />
        </svg>
        <select
          aria-label="可见性 Visibility"
          aria-readonly={bound ? 'true' : undefined}
          disabled={readOnly && !bound}
          value={String(displayValue)}
          onChange={(event) => {
            if (!bound) commit(event.target.value)
          }}
        >
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </label>
    </BindingTargetBlock>
  )
}

function AlignmentRenderer({ value, readOnly, commit, binding }: PropertyPanelRendererProps) {
  const options = ['start', 'center', 'end', 'stretch'] as const
  const target = binding?.getTarget('value')
  const displayValue = target?.effectiveValue ?? value
  const bound = Boolean(target?.binding)
  return (
    <BindingTargetBlock trigger={binding?.renderTrigger('value')}>
      <div className="alignment-property-editor">
        {options.map((option) => (
          <button
            aria-label={`对齐 ${option}`}
            aria-disabled={readOnly || bound}
            aria-pressed={displayValue === option}
            disabled={readOnly && !bound}
            key={option}
            type="button"
            onClick={() => {
              if (!bound) commit(option)
            }}
          >
            <svg aria-hidden="true" data-alignment={option} viewBox="0 0 24 20">
              {option === 'start' ? (
                <>
                  <path d="M4 2v16" />
                  <path d="M7 5h12M7 10h8M7 15h11" />
                </>
              ) : option === 'center' ? (
                <>
                  <path d="M12 2v16" />
                  <path d="M5 5h14M7 10h10M4 15h16" />
                </>
              ) : option === 'end' ? (
                <>
                  <path d="M20 2v16" />
                  <path d="M5 5h12M9 10h8M6 15h11" />
                </>
              ) : (
                <>
                  <path d="M4 2v16M20 2v16" />
                  <path d="M7 5h10M7 10h10M7 15h10" />
                </>
              )}
            </svg>
          </button>
        ))}
      </div>
    </BindingTargetBlock>
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

function EChartsOptionRenderer({ value, readOnly, commit, binding }: PropertyPanelRendererProps) {
  const literalConfig = readChartConfig(value)
  const titleTarget = binding?.getTarget('title')
  const typeTarget = binding?.getTarget('type')
  const seriesTarget = binding?.getTarget('seriesName')
  const dataTarget = binding?.getTarget('data')
  const config: DemoChartConfig = {
    title: typeof titleTarget?.effectiveValue === 'string'
      ? titleTarget.effectiveValue : literalConfig.title,
    type: ['bar', 'line', 'pie'].includes(String(typeTarget?.effectiveValue))
      ? typeTarget?.effectiveValue as DemoChartType : literalConfig.type,
    seriesName: typeof seriesTarget?.effectiveValue === 'string'
      ? seriesTarget.effectiveValue : literalConfig.seriesName,
    data: Array.isArray(dataTarget?.effectiveValue)
      ? dataTarget.effectiveValue as number[] : literalConfig.data,
  }
  const update = (patch: Partial<DemoChartConfig>) => commit(createChartOption({
    ...literalConfig,
    ...patch,
  }))
  const dataSource = dataTarget?.binding ? dataTarget.effectiveValue : value
  const [dataDraft, setDataDraft] = useState({
    source: dataSource,
    text: config.data.join(', '),
    error: '',
  })
  const dataDraftActive = Object.is(dataDraft.source, dataSource)
  const dataText = dataDraftActive ? dataDraft.text : config.data.join(', ')
  const dataError = dataDraftActive ? dataDraft.error : ''
  return (
    <div className="echart-option-editor">
      <label>
        <span>标题</span>
        <BindingTargetLayout trigger={binding?.renderTrigger('title')}>
          <input
            aria-label="图表标题"
            disabled={readOnly && !titleTarget?.binding}
            readOnly={Boolean(titleTarget?.binding)}
            value={config.title}
            onChange={(event) => {
              if (!titleTarget?.binding) update({ title: event.target.value })
            }}
          />
        </BindingTargetLayout>
      </label>
      <label>
        <span>类型</span>
        <BindingTargetLayout trigger={binding?.renderTrigger('type')}>
          <select
            aria-label="图表类型"
            aria-readonly={typeTarget?.binding ? 'true' : undefined}
            disabled={readOnly && !typeTarget?.binding}
            value={config.type}
            onChange={(event) => {
              if (!typeTarget?.binding) update({ type: event.target.value as DemoChartType })
            }}
          >
            <option value="bar">柱状图</option>
            <option value="line">折线图</option>
            <option value="pie">饼图</option>
          </select>
        </BindingTargetLayout>
      </label>
      <label>
        <span>系列</span>
        <BindingTargetLayout trigger={binding?.renderTrigger('seriesName')}>
          <input
            aria-label="系列名称"
            disabled={readOnly && !seriesTarget?.binding}
            readOnly={Boolean(seriesTarget?.binding)}
            value={config.seriesName}
            onChange={(event) => {
              if (!seriesTarget?.binding) update({ seriesName: event.target.value })
            }}
          />
        </BindingTargetLayout>
      </label>
      <label>
        <span>数据</span>
        <BindingTargetLayout trigger={binding?.renderTrigger('data')}>
          <input
            aria-invalid={dataError ? 'true' : undefined}
            aria-label="系列数据"
            disabled={readOnly && !dataTarget?.binding}
            readOnly={Boolean(dataTarget?.binding)}
            value={dataText}
            onChange={(event) => {
              if (dataTarget?.binding) return
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
        </BindingTargetLayout>
        {dataError ? <small role="alert">{dataError}</small> : null}
      </label>
      <EChartView accessible={false} option={createChartOption(config)} />
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
  children: [{
    id: 'rectangle-1',
    label: 'Rectangle',
    canHaveChildren: false,
  }],
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

function findSceneNodeLocation(
  nodes: readonly SceneTreeNode[],
  nodeId: string,
  parentId: string | null = null,
): { parentId: string | null; index: number } | null {
  for (const [index, node] of nodes.entries()) {
    if (node.id === nodeId) return { parentId, index }
    if (node.children) {
      const location = findSceneNodeLocation(node.children, nodeId, node.id)
      if (location) return location
    }
  }
  return null
}

function pathsEqual(
  left: readonly (string | number)[],
  right: readonly (string | number)[],
) {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

const propertyLabels: Readonly<Record<string, string>> = {
  transform: 'Transform',
  'content.text': '文本内容',
  'content.keywords': '关键词',
  'chart.option': '图表配置',
  'transform.position': '位置',
  'transform.size': '尺寸',
  'transform.anchor': '锚点',
  'transform.angle': '旋转',
  'transform.scale': '缩放',
  'appearance.color': '颜色',
  'appearance.opacity': '不透明度',
  'appearance.cornerRadius': '圆角',
}

function propertyLabel(path: readonly (string | number)[]) {
  const key = path.join('.')
  return propertyLabels[key] ?? key
}

function resolveTextProperties(component: TextComponent) {
  return resolvePropertyBindings({
    schema: textPropertySchema,
    value: { content: { text: component.text, keywords: component.keywords } },
    bindings: component.bindings,
    variables: DEMO_VARIABLES,
  }).value
}

function resolveChartOption(component: ChartComponent): EChartsOption {
  return resolvePropertyBindings({
    schema: chartPropertySchema,
    value: { chart: { option: component.option } },
    bindings: component.bindings,
    variables: DEMO_VARIABLES,
    renderers: echartRenderer,
  }).value.chart.option
}

function resolveRectangleProperties(component: RectangleComponent): RectangleProperties {
  return resolvePropertyBindings({
    schema: rectanglePropertySchema,
    value: component.properties,
    bindings: component.bindings,
    variables: DEMO_VARIABLES,
    renderers: rectangleRenderers,
  }).value
}

function propertyHistoryMergeKey(
  componentId: string,
  change: PropertyPanelChange,
): string | undefined {
  return change.reason === 'input'
    ? `${componentId}:${change.path.join('.')}`
    : undefined
}

function DemoWorkspace() {
  const operationLog = useOperationLog()
  const history = useHistory<DemoDocumentSnapshot>({
    textComponents: [],
    chartComponents: [],
    rectangleComponents: [{
      id: 'rectangle-1',
      properties: structuredClone(DEFAULT_RECTANGLE_PROPERTIES),
      defaultProperties: structuredClone(DEFAULT_RECTANGLE_PROPERTIES),
      bindings: [],
    }],
    sceneNodes: defaultSceneNodes,
  })
  const {
    textComponents,
    chartComponents,
    rectangleComponents,
    sceneNodes: normalSceneNodes,
  } = history.value
  const [selectedSceneIds, setSelectedSceneIds] = useState<readonly string[]>(['rectangle-1'])
  const [normalExpandedIds, setNormalExpandedIds] = useState<readonly string[]>(['page'])
  const [dragNodes, setDragNodes] = useState(dragFixtureNodes)
  const [dragSelectedIds, setDragSelectedIds] = useState<readonly string[]>([])
  const [dragExpandedIds, setDragExpandedIds] = useState<readonly string[]>(['page', 'group-a'])
  const [command, setCommand] = useState('')
  const nextTextIdRef = useRef(1)
  const nextChartIdRef = useRef(1)
  const nextRectangleIdRef = useRef(2)
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
  const selectedChartOption = selectedChart ? resolveChartOption(selectedChart) : null

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

  const recordPropertyChange = (
    componentId: string,
    componentLabel: string,
    change: PropertyPanelChange,
  ) => {
    const reset = change.reason === 'reset'
    const label = propertyLabel(change.path)
    const coalesces = change.reason === 'input' || change.reason === 'commit'
    void operationLog.record({
      action: reset ? 'property.reset' : 'property.change',
      category: 'property',
      summary: `${reset ? '重置' : '修改'} ${label}`,
      targets: [{ componentId, componentLabel, path: change.path }],
      source: 'property-panel',
      before: change.previousValue,
      after: change.value,
      metadata: { reason: change.reason },
    }, coalesces ? { coalesceKey: `${componentId}:${change.path.join('.')}` } : undefined)
  }

  const recordBindingChange = (
    componentId: string,
    componentLabel: string,
    current: readonly PropertyPanelBinding[],
    next: readonly PropertyPanelBinding[],
    change: {
      reason: 'bind' | 'unbind' | 'reset' | 'remap'
      target: { path: readonly (string | number)[]; targetId: string }
    },
  ) => {
    const matchesTarget = (binding: PropertyPanelBinding) => (
      binding.target.targetId === change.target.targetId
      && pathsEqual(binding.target.path, change.target.path)
    )
    void operationLog.record({
      action: `binding.${change.reason}`,
      category: 'binding',
      summary: `${change.reason === 'bind' ? '绑定' : change.reason === 'unbind' ? '解绑' : change.reason === 'reset' ? '重置绑定' : '重映射绑定'} ${propertyLabel(change.target.path)}`,
      targets: [{
        componentId,
        componentLabel,
        path: change.target.path,
      }],
      source: 'property-panel',
      before: current.find(matchesTarget),
      after: next.find(matchesTarget),
      metadata: { targetId: change.target.targetId },
    })
  }

  const addTextComponent = (
    parentId: string | null = 'page',
    index?: number,
    source = 'canvas-toolbar',
  ) => {
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
      bindings: [],
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
    void operationLog.record({
      action: 'component.create',
      category: 'component',
      summary: '新增文本组件',
      targets: [{ componentId: id, componentLabel: text }],
      source,
      after: component,
      metadata: { parentId, index },
    })
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
        bindings: [],
      }],
      sceneNodes: insertSceneNode(current.sceneNodes, 'page', undefined, {
        id,
        label: number === 1 ? 'ECharts 图表' : `ECharts 图表 ${number}`,
        canHaveChildren: false,
      }),
    }), { label: '新增 ECharts 图表' })
    setNormalExpandedIds((current) => current.includes('page') ? current : [...current, 'page'])
    setSelectedSceneIds([id])
    void operationLog.record({
      action: 'component.create',
      category: 'component',
      summary: '新增 ECharts 图表',
      targets: [{ componentId: id, componentLabel: 'ECharts 图表' }],
      source: 'canvas-toolbar',
      after: { id, option },
    })
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
        bindings: [],
      }],
      sceneNodes: insertSceneNode(current.sceneNodes, 'page', undefined, {
        id,
        label: number === 1 ? 'Rectangle' : `Rectangle ${number}`,
        canHaveChildren: false,
      }),
    }), { label: '新增 Rectangle' })
    setNormalExpandedIds((current) => current.includes('page') ? current : [...current, 'page'])
    setSelectedSceneIds([id])
    void operationLog.record({
      action: 'component.create',
      category: 'component',
      summary: '新增矩形组件',
      targets: [{ componentId: id, componentLabel: `Rectangle ${number}` }],
      source: 'canvas-toolbar',
      after: { id, properties: DEFAULT_RECTANGLE_PROPERTIES },
    })
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
      const nextNodes = applySceneMove(dragNodes, operation)
      if (nextNodes === dragNodes) return
      setDragNodes(nextNodes)
      void operationLog.record({
        action: 'scene.move',
        category: 'scene',
        summary: `移动 ${operation.nodeIds.length} 个场景节点`,
        targets: operation.nodeIds.map((nodeId) => ({
          componentId: nodeId,
          componentLabel: findSceneNode(dragNodes, nodeId)?.label,
        })),
        source: 'scene-tree',
        before: operation.nodeIds.map((nodeId) => ({ nodeId, ...findSceneNodeLocation(dragNodes, nodeId) })),
        after: { parentId: operation.parentId, index: operation.index },
      })
      return
    }
    if (!useDragFixture && operation.type === 'move') {
      const nextNodes = applySceneMove(normalSceneNodes, operation)
      if (nextNodes === normalSceneNodes) return
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
      void operationLog.record({
        action: 'scene.move',
        category: 'scene',
        summary: `移动 ${operation.nodeIds.length} 个场景节点`,
        targets: operation.nodeIds.map((nodeId) => ({
          componentId: nodeId,
          componentLabel: findSceneNode(normalSceneNodes, nodeId)?.label,
        })),
        source: 'scene-tree',
        before: operation.nodeIds.map((nodeId) => ({ nodeId, ...findSceneNodeLocation(normalSceneNodes, nodeId) })),
        after: { parentId: operation.parentId, index: operation.index },
      })
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
          bindings: structuredClone(sourceText.bindings),
        })
        if (sourceChart) duplicatedChartComponents.push({
          id,
          option: structuredClone(sourceChart.option),
          defaultOption: structuredClone(sourceChart.defaultOption),
          bindings: structuredClone(sourceChart.bindings),
        })
        if (sourceRectangle) duplicatedRectangleComponents.push({
          id,
          properties: structuredClone(sourceRectangle.properties),
          defaultProperties: structuredClone(sourceRectangle.defaultProperties),
          bindings: structuredClone(sourceRectangle.bindings),
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
      void operationLog.record({
        action: 'component.duplicate',
        category: 'component',
        summary: `复制 ${duplicatedIds.length} 个组件`,
        targets: duplicatedIds.map((componentId, index) => ({
          componentId,
          componentLabel: copies[index]?.label,
        })),
        source: 'scene-tree',
        before: operation.sourceNodeIds,
        after: duplicatedIds,
        metadata: { parentId: operation.parentId, index: operation.index },
      })
      return
    }
    if (operation.type === 'create') {
      addTextComponent(operation.parentId, operation.index, 'scene-tree')
    }
    if (operation.type === 'rename') {
      const previousLabel = findSceneNode(normalSceneNodes, operation.nodeId)?.label
      updateTextComponent(operation.nodeId, operation.label)
      void operationLog.record({
        action: 'component.rename',
        category: 'component',
        summary: `重命名 ${previousLabel ?? operation.nodeId}`,
        targets: [{ componentId: operation.nodeId, componentLabel: operation.label }],
        source: 'scene-tree',
        before: previousLabel,
        after: operation.label,
      })
    }
    if (operation.type === 'delete') {
      const deletedIds = collectSceneSubtreeIds(normalSceneNodes, operation.nodeIds)
      if (deletedIds.size === 0) return
      const deletedNodes = [...deletedIds].map((nodeId) => findSceneNode(normalSceneNodes, nodeId))
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
      void operationLog.record({
        action: 'component.delete',
        category: 'component',
        summary: `删除 ${deletedIds.size} 个组件`,
        targets: deletedNodes.filter((node): node is SceneTreeNode => Boolean(node)).map((node) => ({
          componentId: node.id,
          componentLabel: node.label,
        })),
        source: 'scene-tree',
        before: deletedNodes,
        after: undefined,
      })
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
                  binding={{
                    value: selectedText.bindings,
                    variables: DEMO_VARIABLES,
                    onChange: (next, change) => {
                      history.commit((current) => ({
                        ...current,
                        textComponents: current.textComponents.map((component) => (
                          component.id === selectedText.id
                            ? { ...component, bindings: next }
                            : component
                        )),
                      }), { label: '修改文本变量绑定' })
                      recordBindingChange(
                        selectedText.id,
                        selectedText.text,
                        selectedText.bindings,
                        next,
                        change,
                      )
                    },
                  }}
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
                    recordPropertyChange(selectedText.id, selectedText.text, change)
                  }}
                />
              ) : selectedRectangle ? (
                <PropertyPanel
                  aria-label="Rectangle 属性"
                  binding={{
                    value: selectedRectangle.bindings,
                    variables: DEMO_VARIABLES,
                    onChange: (next, change) => {
                      history.commit((current) => ({
                        ...current,
                        rectangleComponents: current.rectangleComponents.map((component) => (
                          component.id === selectedRectangle.id
                            ? { ...component, bindings: next }
                            : component
                        )),
                      }), { label: '修改 Rectangle 变量绑定' })
                      recordBindingChange(
                        selectedRectangle.id,
                        'Rectangle',
                        selectedRectangle.bindings,
                        next,
                        change,
                      )
                    },
                  }}
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
                    recordPropertyChange(selectedRectangle.id, 'Rectangle', change)
                  }}
                />
              ) : selectedChart ? (
                <PropertyPanel
                  aria-label="ECharts 图表属性"
                  binding={{
                    value: selectedChart.bindings,
                    variables: DEMO_VARIABLES,
                    onChange: (next, change) => {
                      history.commit((current) => ({
                        ...current,
                        chartComponents: current.chartComponents.map((component) => (
                          component.id === selectedChart.id
                            ? { ...component, bindings: next }
                            : component
                        )),
                      }), { label: '修改 ECharts 变量绑定' })
                      recordBindingChange(
                        selectedChart.id,
                        readChartConfig(selectedChart.option).title,
                        selectedChart.bindings,
                        next,
                        change,
                      )
                    },
                  }}
                  defaultValue={{ chart: { option: selectedChart.defaultOption } }}
                  header={{
                    icon: <span className="node-icon node-icon--chart">E</span>,
                    title: readChartConfig(selectedChartOption ?? selectedChart.option).title,
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
                    recordPropertyChange(
                      selectedChart.id,
                      readChartConfig(selectedChart.option).title,
                      change,
                    )
                  }}
                />
              ) : (
                <p className="empty-message">选择画布中的组件以编辑属性</p>
              )}
            </div>
          }
          transactionLogPanel={
            <OperationLogPanel />
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
                    {resolveTextProperties(component).content.text}
                  </button>
                ))}
                {orderedChartComponents.map((component) => {
                  const option = resolveChartOption(component)
                  return (
                  <button
                    aria-label={`选择 ${readChartConfig(option).title}`}
                    className="chart-node-button"
                    key={component.id}
                    type="button"
                    onClick={() => setSelectedSceneIds([component.id])}
                  >
                    <EChartView accessible option={option} />
                  </button>
                  )
                })}
                {orderedRectangleComponents.map((component) => {
                  const { transform, appearance, propertyDemo, state } = resolveRectangleProperties(component)
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

function App() {
  const workspace = new URLSearchParams(window.location.search).get('workspace') ?? 'default'
  return (
    <OperationLogProvider scopeId={`compose-ui-demo:${workspace}`}>
      <DemoWorkspace />
    </OperationLogProvider>
  )
}

export default App
