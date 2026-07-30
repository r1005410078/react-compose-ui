import type {
  ComposeEntityPreset,
  ComposeRendererDefinition,
  ComposeRendererInspectorProps,
  ComposeRendererProps,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createTransactionRuntime,
  getComposeHierarchy,
} from '@compose-ui/core'
import type {
  ComposeDocument,
  ComposeEntity,
  JsonObject,
  JsonValue,
} from '@compose-ui/core'
import {
  ComposeEditor,
  useComposeEditorController,
} from '@compose-ui/editor'
import type { ComposeEditorTransactionEvent } from '@compose-ui/editor'
import { createComposeAssetResolver } from '@compose-ui/assets'
import { createComposeBasicMaterials } from '@compose-ui/materials'
import {
  ComposeOperationLogPanel,
  useComposeOperationLog,
} from '@compose-ui/operation-log'
import type { ComposeOperationLogCategory, ComposeOperationLogRecordInput } from '@compose-ui/operation-log'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
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
import type { ComposeEditorActivePage } from '@compose-ui/editor'
import * as v from 'valibot'
import { createDemoAssetProvider } from './demo-asset-provider'

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
  schemaVersion: 5,
  canvas: createDefaultCanvasSettings(),
  output: createDefaultOutputSettings(),
  rootIds: [],
  entities: {},
}

const chartSchema = v.object({
  title: v.pipe(v.string(), v.title('图表标题')),
  values: v.pipe(v.array(v.number()), v.title('数据')),
})

function setAllProps(
  entity: ComposeEntity,
  current: JsonObject,
  value: JsonObject,
  dispatch: ComposeRendererInspectorProps['dispatch'],
  mergeKey: string,
) {
  const changed = [...new Set([...Object.keys(current), ...Object.keys(value)])]
    .filter((key) => JSON.stringify(current[key]) !== JSON.stringify(value[key]))
    .slice(0, 2)
    .map((key) => `${key} ${formatLogValue(current[key])} → ${formatLogValue(value[key])}`)
  dispatch({
    id: `inspector:${entity.id}:${Date.now()}`,
    type: BUILTIN_COMMAND_TYPES.setRendererProps,
    payload: { entityId: entity.id, props: value },
    meta: {
      label: `Update ${entity.name}${changed.length > 0 ? ` · ${changed.join(', ')}` : ''}`,
      source: 'inspector',
      targetIds: [entity.id],
      mergeKey,
    },
  })
}

function formatLogValue(value: JsonValue | undefined) {
  if (value === undefined) return 'undefined'
  const serialized = JSON.stringify(value)
  return serialized.length > 28 ? `${serialized.slice(0, 27)}…` : serialized
}

function ChartRenderer({ props }: ComposeRendererProps) {
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

function ChartInspector({ entity, renderer, dispatch, readOnly }: ComposeRendererInspectorProps) {
  const values = Array.isArray(renderer.props.values)
    ? renderer.props.values.filter((item): item is number => typeof item === 'number')
    : [18, 28, 22, 36]
  const value = {
    title: typeof renderer.props.title === 'string' ? renderer.props.title : '季度数据',
    values,
  }
  return (
    <ComposePropertyPanel
      aria-label="ECharts 图表属性"
      defaultValue={{ title: '季度数据', values: [18, 28, 22, 36] }}
      readOnly={readOnly}
      schema={chartSchema}
      value={value}
      onValueChange={(next) =>
        setAllProps(
          entity,
          renderer.props,
          next,
          dispatch,
          `inspector:${entity.id}`,
        )}
    />
  )
}

const echartsRenderer = {
  type: 'echarts-bar',
  label: 'ECharts Chart',
  renderer: ChartRenderer,
  inspector: ChartInspector,
} satisfies ComposeRendererDefinition

const echartsPreset = {
  id: 'echarts-bar',
  label: 'ECharts Chart',
  defaultName: 'ECharts Chart',
  icon: <span aria-hidden="true">▥</span>,
  createComponents: () => ({
    Transform: {
      position: { x: 0, y: 0 },
      size: { width: 420, height: 260 },
      rotation: 0,
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Appearance: {
      backgroundPaint: { kind: 'solid', color: 'transparent' },
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      opacity: 1,
      shadow: null,
    },
    Renderer: {
      type: 'echarts-bar',
      props: {
        title: 'Quarterly data',
        values: [18, 28, 22, 36],
      },
    },
  }),
} satisfies ComposeEntityPreset

const basicMaterials = createComposeBasicMaterials({
  extensions: {
    renderers: [echartsRenderer],
    presets: [echartsPreset],
  },
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
  if (targetIds.length === 1) return document.entities[targetIds[0]!] ?? null
  return Object.fromEntries(targetIds.map((id) => [id, document.entities[id] ?? null]))
}

function eventCategory(event: ComposeEditorTransactionEvent): ComposeOperationLogCategory {
  const commandType = event.transaction?.commandType ?? ''
  if (
    commandType.startsWith('entity.renderer.')
    || commandType.startsWith('entity.appearance.')
    || commandType.startsWith('entity.component.')
    || commandType.startsWith('entity.transform.')
    || commandType === 'transaction.batch'
      && event.source === 'inspector'
  ) return 'property'
  if (
    commandType === BUILTIN_COMMAND_TYPES.createEntity
    || commandType === BUILTIN_COMMAND_TYPES.deleteEntity
    || commandType === BUILTIN_COMMAND_TYPES.duplicateEntity
  ) {
    return 'component'
  }
  return 'scene'
}

function targetPath(event: ComposeEditorTransactionEvent, targetId: string) {
  const patch = event.transaction?.forward.find((item) =>
    item.path[0] === 'entities' && item.path[1] === targetId)
  return patch?.path.slice(2)
}

export function StageDemoWorkspace() {
  const operationLog = useComposeOperationLog()
  const [rootRuntime] = useState(() => createTransactionRuntime({
    document: emptyDocument,
    initialLabel: 'Initial state',
  }))
  /**
   * 当前活动页面；由 Editor 的页面工作区回传。
   *
   * @remarks
   * 宿主拥有 controller，因此「工作区跟随活动页面」由这里换 runtime 实现。没有页面打开时
   * 回落到 rootRuntime，与未启用页面系统时的行为一致。
   */
  const [activePage, setActivePage] = useState<ComposeEditorActivePage | null>(null)
  const runtime = activePage?.runtime ?? rootRuntime
  const previousDocument = useRef(runtime.document)
  const observedRuntime = useRef(runtime)
  const lastRecordedCommitId = useRef<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState<'document' | 'container'>('document')
  const nextId = useRef(0)
  const idFactory = useCallback(() => `stage-demo-${nextId.current++}`, [])
  useEffect(() => {
    // 换 runtime 表示换文档：操作日志的 diff 基线必须跟着换，否则切页面后的第一笔
    // 事务会与上一份文档做比较。
    if (observedRuntime.current !== runtime) {
      observedRuntime.current = runtime
      previousDocument.current = runtime.document
    }
  }, [runtime])
  const recordTransaction = useCallback((event: ComposeEditorTransactionEvent) => {
    const beforeDocument = previousDocument.current
    const afterDocument = runtime.document
    previousDocument.current = afterDocument
    const transaction = event.transaction
    // runtime 会为同一 mergeKey 保留稳定 transaction ID。连续色盘采样仍需驱动舞台
    // 预览，但不应反复序列化不断增长的 Patch 列表并写入 IndexedDB 操作日志。
    if (event.direction === 'commit' && transaction?.id === lastRecordedCommitId.current) return
    if (event.direction === 'commit') lastRecordedCommitId.current = transaction?.id ?? null
    const input: ComposeOperationLogRecordInput = {
      action: event.direction === 'commit'
        ? transaction?.commandType ?? 'document.commit'
        : `document.${event.direction}`,
      category: eventCategory(event),
      summary: eventSummary(event),
      source: event.source,
      targets: event.targets.map((componentId) => ({
        componentId,
        componentLabel: afterDocument.entities[componentId]?.name
          ?? beforeDocument.entities[componentId]?.name,
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
    idFactory,
    onTransaction: recordTransaction,
  })
  const [assetProvider] = useState(createDemoAssetProvider)
  const assetResolver = useMemo(
    () => createComposeAssetResolver(assetProvider),
    [assetProvider],
  )
  // 配置对象必须保持稳定引用：Editor 会据此派生页面 Store。
  const pagesConfig = useMemo(() => ({ onActiveSessionChange: setActivePage }), [])
  const selectedContainerId = controller.selectedIds.length === 1
    && controller.document.entities[controller.selectedIds[0]!]
    && getComposeHierarchy(controller.document.entities[controller.selectedIds[0]!]!)
    ? controller.selectedIds[0]!
    : null

  return (
    <>
      <ComposeEditor
        className="editor-workspace"
        assets={{
          browser: { provider: assetProvider },
          resolver: assetResolver,
        }}
        controller={controller}
        pages={pagesConfig}
        slots={{
          stageToolbar: (
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
          ),
          transactionLog: <ComposeOperationLogPanel />,
        }}
      />
      {previewOpen ? (
        <div aria-label="文档预览对话框" className="stage-demo__preview-backdrop" role="dialog">
          <div className="stage-demo__preview-shell">
            <button type="button" onClick={() => setPreviewOpen(false)}>关闭预览</button>
            <button type="button" onClick={() => setPreviewMode('document')}>文档</button>
            <button
              disabled={!selectedContainerId}
              type="button"
              onClick={() => setPreviewMode('container')}
            >
              选中容器
            </button>
            <ComposePreview
              assetResolver={assetResolver}
              document={controller.document}
              registry={registry}
              target={previewMode === 'container' && selectedContainerId
                ? { kind: 'container', entityId: selectedContainerId }
                : { kind: 'document' }}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
