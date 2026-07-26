import type {
  ComponentDefinition,
  ComponentInspectorProps,
  ComponentRendererProps,
} from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createTransactionRuntime,
} from '@compose-ui/core'
import type {
  ComposeComponentNode,
  ComposeDocument,
  JsonObject,
  JsonValue,
} from '@compose-ui/core'
import {
  ComposeEditor,
  useComposeEditorController,
} from '@compose-ui/editor'
import type { ComposeEditorTransactionEvent } from '@compose-ui/editor'
import { createBasicMaterials } from '@compose-ui/materials'
import {
  OperationLogPanel,
  useOperationLog,
} from '@compose-ui/operation-log'
import type { OperationLogCategory, OperationLogRecordInput } from '@compose-ui/operation-log'
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

function PreviewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  )
}

const emptyDocument: ComposeDocument = {
  schemaVersion: 3,
  canvas: createDefaultCanvasSettings(),
  output: createDefaultOutputSettings(),
  rootIds: [],
  nodes: {},
}

const chartSchema = v.object({
  title: v.pipe(v.string(), v.title('图表标题')),
  values: v.pipe(v.array(v.number()), v.title('数据')),
})

function setAllProps(
  node: ComposeComponentNode,
  value: JsonObject,
  dispatch: ComponentInspectorProps['dispatch'],
  mergeKey: string,
) {
  const changed = [...new Set([...Object.keys(node.props), ...Object.keys(value)])]
    .filter((key) => JSON.stringify(node.props[key]) !== JSON.stringify(value[key]))
    .slice(0, 2)
    .map((key) => `${key} ${formatLogValue(node.props[key])} → ${formatLogValue(value[key])}`)
  dispatch({
    id: `inspector:${node.id}:${Date.now()}`,
    type: 'node.props.set',
    payload: { nodeId: node.id, path: [], value },
    meta: {
      label: `Update ${node.name}${changed.length > 0 ? ` · ${changed.join(', ')}` : ''}`,
      source: 'inspector',
      targetIds: [node.id],
      mergeKey,
    },
  })
}

function formatLogValue(value: JsonValue | undefined) {
  if (value === undefined) return 'undefined'
  const serialized = JSON.stringify(value)
  return serialized.length > 28 ? `${serialized.slice(0, 27)}…` : serialized
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
        setAllProps(node, next, dispatch, `inspector:${node.id}`)}
    />
  )
}

const echartsDefinition = {
  type: 'echarts-bar',
  label: 'ECharts Chart',
  icon: <span aria-hidden="true">▥</span>,
  defaultSize: { width: 420, height: 260 },
  createDefaultProps: () => ({
    title: 'Quarterly data',
    values: [18, 28, 22, 36],
  }),
  renderer: ChartRenderer,
  inspector: ChartInspector,
} satisfies ComponentDefinition

const basicMaterials = createBasicMaterials({
  extensions: [echartsDefinition],
})
const { registry } = basicMaterials

function eventSummary(event: ComposeEditorTransactionEvent) {
  const label = event.transaction?.label ?? 'transaction'
  if (event.direction === 'commit') return label
  if (event.direction === 'undo') return `Undo · ${label}`
  if (event.direction === 'redo') return `Redo · ${label}`
  return `Navigate history · ${event.transactionIds.length} transaction`
    + (event.transactionIds.length === 1 ? '' : 's')
}

function snapshotTargets(document: ComposeDocument, targetIds: readonly string[]) {
  if (targetIds.length === 1) return document.nodes[targetIds[0]!] ?? null
  return Object.fromEntries(targetIds.map((id) => [id, document.nodes[id] ?? null]))
}

function eventCategory(event: ComposeEditorTransactionEvent): OperationLogCategory {
  const commandType = event.transaction?.commandType ?? ''
  if (
    commandType.startsWith('node.props.')
    || commandType.startsWith('node.style.')
    || commandType === 'transaction.batch'
      && event.source === 'inspector'
  ) return 'property'
  if (
    commandType === 'node.create'
    || commandType === 'node.delete'
    || commandType === 'node.duplicate'
  ) {
    return 'component'
  }
  return 'scene'
}

function targetPath(event: ComposeEditorTransactionEvent, targetId: string) {
  const patch = event.transaction?.forward.find((item) =>
    item.path[0] === 'nodes' && item.path[1] === targetId)
  return patch?.path.slice(2)
}

export function StageDemoWorkspace() {
  const operationLog = useOperationLog()
  const [runtime] = useState(() => createTransactionRuntime({
    document: emptyDocument,
    initialLabel: 'Initial state',
  }))
  const previousDocument = useRef(runtime.document)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState<'document' | 'frame'>('document')
  const nextId = useRef(0)
  const idFactory = useCallback(() => `stage-demo-${nextId.current++}`, [])
  const recordTransaction = useCallback((event: ComposeEditorTransactionEvent) => {
    const beforeDocument = previousDocument.current
    const afterDocument = runtime.document
    previousDocument.current = afterDocument
    const transaction = event.transaction
    const input: OperationLogRecordInput = {
      action: event.direction === 'commit'
        ? transaction?.commandType ?? 'document.commit'
        : `document.${event.direction}`,
      category: eventCategory(event),
      summary: eventSummary(event),
      source: event.source,
      targets: event.targets.map((componentId) => ({
        componentId,
        componentLabel: afterDocument.nodes[componentId]?.name
          ?? beforeDocument.nodes[componentId]?.name,
        path: targetPath(event, componentId),
      })),
      metadata: {
        commandType: transaction?.commandType,
        direction: event.direction,
        forwardPatches: transaction?.forward,
        inversePatches: transaction?.inverse,
        transactionIds: event.transactionIds,
      },
      ...(event.targets.length > 0 ? {
        before: snapshotTargets(beforeDocument, event.targets),
        after: snapshotTargets(afterDocument, event.targets),
      } : {}),
    }
    return operationLog.record(input, {
      coalesceKey: event.direction === 'commit' && transaction?.mergeKey
        ? `transaction:${transaction.id}`
        : undefined,
    }).then(() => undefined)
  }, [operationLog, runtime])
  const controller = useComposeEditorController({
    runtime,
    registry,
    framePresets: basicMaterials.framePresets,
    containerInspector: basicMaterials.ContainerInspector,
    idFactory,
    onTransaction: recordTransaction,
  })
  const selectedFrameId = controller.selectedIds.length === 1
    && controller.document.nodes[controller.selectedIds[0]!]?.kind === 'frame'
    ? controller.selectedIds[0]!
    : null

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
              aria-label="打开预览"
              title="打开预览"
              type="button"
              onClick={() => {
                setPreviewMode('document')
                setPreviewOpen(true)
              }}
            >
              <PreviewIcon />
            </button>
          </>
        )}
        transactionLogPanel={<OperationLogPanel />}
      />
      {previewOpen ? (
        <div aria-label="文档预览对话框" className="stage-demo__preview-backdrop" role="dialog">
          <div className="stage-demo__preview-shell">
            <button type="button" onClick={() => setPreviewOpen(false)}>关闭预览</button>
            <button type="button" onClick={() => setPreviewMode('document')}>文档</button>
            <button
              disabled={!selectedFrameId}
              type="button"
              onClick={() => setPreviewMode('frame')}
            >
              选中 Frame
            </button>
            <ComposePreview
              document={controller.document}
              registry={registry}
              target={previewMode === 'frame' && selectedFrameId
                ? { kind: 'frame', frameId: selectedFrameId }
                : { kind: 'document' }}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
