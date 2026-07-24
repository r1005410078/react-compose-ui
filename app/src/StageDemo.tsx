import { createComponentRegistry } from '@compose-ui/component-registry'
import type {
  ComponentDefinition,
  ComponentInspectorProps,
  ComponentRendererProps,
} from '@compose-ui/component-registry'
import { createTransactionRuntime } from '@compose-ui/core'
import type {
  ComposeDocument,
  JsonObject,
} from '@compose-ui/core'
import {
  ComposeEditor,
  useComposeEditorController,
} from '@compose-ui/editor'
import type { ComposeEditorTransactionEvent } from '@compose-ui/editor'
import {
  OperationLogPanel,
  useOperationLog,
} from '@compose-ui/operation-log'
import { PropertyPanel } from '@compose-ui/property-panel'
import { ComposePreview } from '@compose-ui/preview'
import { BarChart } from 'echarts/charts'
import {
  GridComponent,
  TitleComponent,
} from 'echarts/components'
import {
  init as initECharts,
  use as registerECharts,
} from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as v from 'valibot'

registerECharts([BarChart, GridComponent, TitleComponent, CanvasRenderer])

const emptyDocument: ComposeDocument = {
  schemaVersion: 1,
  rootIds: [],
  nodes: {},
}

const rectangleSchema = v.object({
  color: v.pipe(v.string(), v.title('填充颜色')),
  opacity: v.pipe(v.number(), v.minValue(0), v.maxValue(1), v.title('不透明度')),
  cornerRadius: v.pipe(v.number(), v.minValue(0), v.title('圆角')),
})

const textSchema = v.object({
  text: v.pipe(v.string(), v.title('文本内容')),
  color: v.pipe(v.string(), v.title('文字颜色')),
  fontSize: v.pipe(v.number(), v.minValue(8), v.title('字号')),
})

const chartSchema = v.object({
  title: v.pipe(v.string(), v.title('图表标题')),
  values: v.pipe(v.array(v.number()), v.title('数据')),
})

function setAllProps(
  nodeId: string,
  value: JsonObject,
  dispatch: ComponentInspectorProps['dispatch'],
  mergeKey: string,
) {
  dispatch({
    id: `inspector:${nodeId}:${Date.now()}`,
    type: 'node.props.set',
    payload: { nodeId, path: [], value },
    meta: {
      label: '修改组件属性',
      source: 'inspector',
      targetIds: [nodeId],
      mergeKey,
    },
  })
}

function RectangleRenderer({ props }: ComponentRendererProps) {
  const color = typeof props.color === 'string' ? props.color : '#2f7df6'
  const opacity = typeof props.opacity === 'number' ? props.opacity : 1
  const cornerRadius = typeof props.cornerRadius === 'number' ? props.cornerRadius : 12
  return (
    <div
      className="stage-demo__rectangle"
      style={{ backgroundColor: color, borderRadius: cornerRadius, opacity }}
    >
      Rectangle
    </div>
  )
}

function RectangleInspector({ node, dispatch }: ComponentInspectorProps) {
  const value = {
    color: typeof node.props.color === 'string' ? node.props.color : '#2f7df6',
    opacity: typeof node.props.opacity === 'number' ? node.props.opacity : 1,
    cornerRadius: typeof node.props.cornerRadius === 'number'
      ? node.props.cornerRadius
      : 12,
  }
  return (
    <PropertyPanel
      aria-label="Rectangle 属性"
      defaultValue={{ color: '#2f7df6', opacity: 1, cornerRadius: 12 }}
      schema={rectangleSchema}
      value={value}
      onValueChange={(next) =>
        setAllProps(node.id, next, dispatch, `inspector:${node.id}`)}
    />
  )
}

function TextRenderer({ props }: ComponentRendererProps) {
  return (
    <div
      className="stage-demo__text"
      style={{
        color: typeof props.color === 'string' ? props.color : '#172033',
        fontSize: typeof props.fontSize === 'number' ? props.fontSize : 24,
      }}
    >
      {typeof props.text === 'string' ? props.text : '文本'}
    </div>
  )
}

function TextInspector({ node, dispatch }: ComponentInspectorProps) {
  const value = {
    text: typeof node.props.text === 'string' ? node.props.text : '大屏标题',
    color: typeof node.props.color === 'string' ? node.props.color : '#172033',
    fontSize: typeof node.props.fontSize === 'number' ? node.props.fontSize : 24,
  }
  return (
    <PropertyPanel
      aria-label="文本组件属性"
      defaultValue={{ text: '大屏标题', color: '#172033', fontSize: 24 }}
      schema={textSchema}
      value={value}
      onValueChange={(next) =>
        setAllProps(node.id, next, dispatch, `inspector:${node.id}`)}
    />
  )
}

function ChartRenderer({ props }: ComponentRendererProps) {
  const root = useRef<HTMLDivElement>(null)
  const title = typeof props.title === 'string' ? props.title : '季度数据'
  const values = useMemo(() => Array.isArray(props.values)
    ? props.values.filter((item): item is number => typeof item === 'number')
    : [18, 28, 22, 36], [props.values])

  useEffect(() => {
    const element = root.current
    if (!element) return
    const chart = initECharts(element)
    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: 38, right: 16, top: 48, bottom: 28 },
      title: { text: title, left: 12, textStyle: { color: '#dce8fa', fontSize: 14 } },
      xAxis: {
        type: 'category',
        data: values.map((_, index) => `Q${index + 1}`),
        axisLabel: { color: '#91a0b6' },
      },
      yAxis: { type: 'value', axisLabel: { color: '#91a0b6' } },
      series: [{ type: 'bar', data: values, itemStyle: { color: '#5794f2' } }],
    })
    const resize = () => chart.resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      chart.dispose()
    }
  }, [title, values])

  return <div aria-label={title} className="stage-demo__chart" ref={root} role="img" />
}

function ChartInspector({ node, dispatch }: ComponentInspectorProps) {
  const values = Array.isArray(node.props.values)
    ? node.props.values.filter((item): item is number => typeof item === 'number')
    : [18, 28, 22, 36]
  const value = {
    title: typeof node.props.title === 'string' ? node.props.title : '季度数据',
    values,
  }
  return (
    <PropertyPanel
      aria-label="ECharts 图表属性"
      defaultValue={{ title: '季度数据', values: [18, 28, 22, 36] }}
      schema={chartSchema}
      value={value}
      onValueChange={(next) =>
        setAllProps(node.id, next, dispatch, `inspector:${node.id}`)}
    />
  )
}

const definitions = [
  {
    type: 'rectangle',
    label: '矩形',
    icon: <span aria-hidden="true">▭</span>,
    defaultSize: { width: 240, height: 140 },
    createDefaultProps: () => ({
      color: '#2f7df6',
      opacity: 1,
      cornerRadius: 12,
    }),
    renderer: RectangleRenderer,
    inspector: RectangleInspector,
  },
  {
    type: 'text',
    label: '文本',
    icon: <span aria-hidden="true">T</span>,
    defaultSize: { width: 280, height: 72 },
    createDefaultProps: () => ({
      text: '大屏标题',
      color: '#172033',
      fontSize: 24,
    }),
    renderer: TextRenderer,
    inspector: TextInspector,
  },
  {
    type: 'echarts-bar',
    label: 'ECharts 图表',
    icon: <span aria-hidden="true">▥</span>,
    defaultSize: { width: 420, height: 260 },
    createDefaultProps: () => ({
      title: '季度数据',
      values: [18, 28, 22, 36],
    }),
    renderer: ChartRenderer,
    inspector: ChartInspector,
  },
] satisfies readonly ComponentDefinition[]

const registry = createComponentRegistry(definitions)

function eventSummary(event: ComposeEditorTransactionEvent) {
  if (event.direction === 'commit') return event.transaction?.label ?? '提交事务'
  if (event.direction === 'undo') return '撤销事务'
  if (event.direction === 'redo') return '重做事务'
  return '跳转历史'
}

export function StageDemoWorkspace() {
  const operationLog = useOperationLog()
  const [runtime] = useState(() => createTransactionRuntime({
    document: emptyDocument,
  }))
  const [previewOpen, setPreviewOpen] = useState(false)
  const nextId = useRef(0)
  const idFactory = useCallback(() => `stage-demo-${nextId.current++}`, [])
  const recordTransaction = useCallback((event: ComposeEditorTransactionEvent) =>
    operationLog.record({
      action: `document.${event.direction}`,
      category: event.source === 'inspector' ? 'property' : 'scene',
      summary: eventSummary(event),
      source: event.source,
      targets: event.targets.map((componentId) => ({
        componentId,
        componentLabel: runtime.document.nodes[componentId]?.name,
      })),
      metadata: {
        direction: event.direction,
        transactionIds: event.transactionIds,
      },
    }).then(() => undefined), [operationLog, runtime])
  const controller = useComposeEditorController({
    runtime,
    registry,
    idFactory,
    onTransaction: recordTransaction,
  })

  return (
    <>
      <ComposeEditor
        className="editor-workspace"
        controller={controller}
        stageToolbar={(
          <>
            {controller.stageToolbar}
            <button
              className="stage-demo__preview-button"
              disabled={!controller.activeFrameId}
              type="button"
              onClick={() => setPreviewOpen(true)}
            >
              预览 Frame
            </button>
          </>
        )}
        transactionLogPanel={<OperationLogPanel />}
      />
      {previewOpen && controller.activeFrameId ? (
        <div aria-label="Frame 预览对话框" className="stage-demo__preview-backdrop" role="dialog">
          <div className="stage-demo__preview-shell">
            <button type="button" onClick={() => setPreviewOpen(false)}>关闭预览</button>
            <ComposePreview
              document={controller.document}
              frameId={controller.activeFrameId}
              registry={registry}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
