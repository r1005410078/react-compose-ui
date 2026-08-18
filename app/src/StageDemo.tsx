import type {
  ComposeEntityPreset,
  ComposeRendererDefinition,
  ComposeRendererInspectorProps,
  ComposeRendererProps,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  createDefaultComposeLayoutItem,
  createComposeFrameEntity,
  createTransactionRuntime,
  resolveOwningFrameId,
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
import { createComposeComponentStore } from '@compose-ui/component-library'
import {
  ComposeEchartsMaterialIcon,
  createComposeBasicMaterials,
} from '@compose-ui/materials'
import {
  ComposeOperationLogPanel,
  useComposeOperationLog,
} from '@compose-ui/operation-log'
import type { ComposeOperationLogCategory, ComposeOperationLogRecordInput } from '@compose-ui/operation-log'
import {
  ComposePropertyPanel,
  type ComposePropertyPanelBindingConfig,
} from '@compose-ui/property-panel'
import { ComposePreviewDialog } from '@compose-ui/preview'
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
import type {
  ComposeEditorActiveComponentSession,
  ComposeEditorActivePage,
} from '@compose-ui/editor'
import { useComposePageCatalog, useNodeEditorPort } from '@compose-ui/editor'
import { createComposePageDocumentLoader, createComposePageStore } from '@compose-ui/pages'
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

const DEMO_FRAME_ID = 'frame-root'

const emptyDocument: ComposeDocument = {
  schemaVersion: 7,
  canvas: createDefaultCanvasSettings(),
  rootIds: [DEMO_FRAME_ID],
  entities: { [DEMO_FRAME_ID]: createComposeFrameEntity({ id: DEMO_FRAME_ID, name: '画板' }) },
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
      backgroundPaint: { kind: 'solid', color: 'transparent' },
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

function ActionButtonRenderer({ props }: ComposeRendererProps) {
  return (
    <button
      className="stage-demo__action-button"
      type="button"
      onClick={typeof props.onClick === 'function'
        ? props.onClick as () => void
        : undefined}
    >
      {typeof props.label === 'string' ? props.label : 'Action'}
    </button>
  )
}

const actionButtonRenderer = {
  type: 'action-button',
  label: 'Action Button',
  renderer: ActionButtonRenderer,
  propContracts: [
    {
      name: 'label',
      kind: 'value',
      label: 'Label',
      category: 'button',
      validate: (value: unknown) => typeof value === 'string' ? true : 'Label must be a string',
      affectsMeasurement: false,
    },
    {
      name: 'onClick',
      kind: 'method',
      label: 'On click',
      category: 'button',
      role: 'event-handler',
    },
  ],
  propCategories: [{ id: 'button', label: '按钮' }],
} satisfies ComposeRendererDefinition

function ChartInspector({
  authoredProps,
  entity,
  dispatch,
  propsBinding,
  readOnly,
}: ComposeRendererInspectorProps) {
  const props = propsBinding?.baseProps ?? authoredProps
  const values = Array.isArray(props.values)
    ? props.values.filter((item): item is number => typeof item === 'number')
    : [18, 28, 22, 36]
  const value = {
    title: typeof props.title === 'string' ? props.title : '季度数据',
    values,
  }
  const binding = propsBinding ? {
    value: ['title', 'values'].flatMap((propName) => {
      const exportName = propsBinding.fields[propName]?.exportName
      return exportName ? [{
        target: { path: [propName], targetId: 'value' },
        variableId: exportName,
      }] : []
    }),
    variables: propsBinding.variables.map((variable) => ({
      ...variable,
      scope: 'page' as const,
    })),
    isTargetEnabled: ({ address }) => (
      address.targetId === 'value'
      && address.path.length === 1
      && (address.path[0] === 'title' || address.path[0] === 'values')
    ),
    onChange: (next, change) => {
      const propName = change.target.path[0]
      if (propName !== 'title' && propName !== 'values') return
      const selected = next.find((item) => item.target.path[0] === propName)
      propsBinding.setField(propName, selected?.variableId ?? null)
    },
  } satisfies ComposePropertyPanelBindingConfig : undefined
  return (
    <ComposePropertyPanel
      aria-label="ECharts 图表属性"
      binding={binding}
      defaultValue={{ title: '季度数据', values: [18, 28, 22, 36] }}
      readOnly={readOnly}
      schema={chartSchema}
      value={value}
      onValueChange={(next) =>
        setAllProps(
          entity,
          authoredProps,
          { ...authoredProps, ...next },
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
  propContracts: [
    {
      name: 'title',
      kind: 'value',
      label: 'Title',
      category: 'chart',
      affectsMeasurement: false,
      validate: (value: unknown) => v.safeParse(chartSchema.entries.title, value).success
        ? true
        : 'Title must be a string',
    },
    {
      name: 'values',
      kind: 'value',
      label: 'Values',
      category: 'chart',
      affectsMeasurement: false,
      validate: (value: unknown) => v.safeParse(chartSchema.entries.values, value).success
        ? true
        : 'Values must be an array of numbers',
    },
  ],
  propCategories: [{ id: 'chart', label: '图表' }],
  inspectorPropNames: ['title', 'values'],
  inspector: ChartInspector,
} satisfies ComposeRendererDefinition

const echartsPreset = {
  id: 'echarts-bar',
  label: 'ECharts Chart',
  defaultName: 'ECharts Chart',
  icon: <ComposeEchartsMaterialIcon />,
  createComponents: () => ({
    Transform: { rotation: 0 },
    LayoutItem: createDefaultComposeLayoutItem(420, 260),
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
    renderers: [echartsRenderer, actionButtonRenderer],
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
  const demonstrateComponentFailures = new URLSearchParams(window.location.search)
    .has('component-failure-demo')
  const operationLog = useComposeOperationLog()
  // 页面目录仍在异步读取时，controller 需要一个短暂的 bootstrap runtime；页面模式不会为它
  // 创建中央 Canvas 标签，首页会解析后立即接管。
  const [bootstrapRuntime] = useState(() => createTransactionRuntime({
    document: emptyDocument,
    initialLabel: 'Initial state',
  }))
  /**
   * 当前活动页面；由 Editor 的页面工作区回传。
   *
   * @remarks
   * 宿主拥有 controller，因此「工作区跟随活动页面」由这里换 runtime 实现。首页解析前
   * controller 使用 bootstrap runtime，但页面模式不会将它呈现为可编辑画布。
   */
  const [activePage, setActivePage] = useState<ComposeEditorActivePage | null>(null)
  const [activeComponent, setActiveComponent] = useState<ComposeEditorActiveComponentSession | null>(null)
  const runtime = activeComponent?.runtime ?? activePage?.runtime ?? bootstrapRuntime
  const previousDocument = useRef(runtime.document)
  const observedRuntime = useRef(runtime)
  const lastRecordedCommitId = useRef<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
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
  const [assetProvider] = useState(createDemoAssetProvider)
  const [providerOffline, setProviderOffline] = useState(false)
  const [componentStore] = useState(() => createComposeComponentStore({ provider: assetProvider }))
  /**
   * 宿主同时拥有页面 Store 与 controller。
   *
   * @remarks
   * node 属性的候选来自页面目录，而 controller 由宿主创建，因此 Store 也放在宿主侧，
   * 再通过 pages.store 交给 Editor 复用同一份缓存。
   */
  const [pageStore] = useState(() => createComposePageStore({ provider: assetProvider }))
  const pageCatalog = useComposePageCatalog(pageStore)
  const pageLoader = useMemo(() => createComposePageDocumentLoader(pageStore), [pageStore])
  const nodeEditPort = useNodeEditorPort({
    catalog: pageCatalog,
    providerId: assetProvider.id,
  })
  const controller = useComposeEditorController({
    runtime,
    registry,
    idFactory,
    nodeEditPort,
    pageLoader,
    componentStore,
    scriptScope: activePage?.scriptScope,
    onTransaction: recordTransaction,
  })
  const assetResolver = useMemo(
    () => createComposeAssetResolver(assetProvider),
    [assetProvider],
  )
  const pagesConfig = useMemo(
    () => ({ store: pageStore, onActiveSessionChange: setActivePage }),
    [pageStore],
  )
  const componentsConfig = useMemo(
    () => ({ store: componentStore, onActiveSessionChange: setActiveComponent }),
    [componentStore],
  )
  // 预览目标只有 Frame 一种：取当前选区所属的画板。
  const selectedFrameId = controller.selectedIds.length === 1
    ? resolveOwningFrameId(controller.document, controller.selectedIds[0]!)
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
        components={componentsConfig}
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
                onClick={() => setPreviewOpen(true)}
              >
                <PreviewIcon />
              </button>
            </>
          ),
          transactionLog: <ComposeOperationLogPanel />,
        }}
      />
      <ComposePreviewDialog
        assetResolver={assetResolver}
        selectedFrameId={selectedFrameId}
        dialogLabel="文档预览对话框"
        document={controller.document}
        page={activePage?.page}
        messages={{
          title: '预览',
          document: '文档',
          selectedFrame: '选中画板',
          target: '预览范围',
          scale: '预览缩放',
          enterFullscreen: '全屏预览',
          exitFullscreen: '退出全屏预览',
          close: '关闭预览',
          closeHint: '按 Esc 关闭预览',
        }}
        open={previewOpen}
        pageLoader={pageLoader}
        registry={registry}
        onOpenChange={setPreviewOpen}
      />
      {demonstrateComponentFailures ? (
        <section aria-label="组件容错演示" className="stage-demo__failure-controls">
          <strong>组件容错演示</strong>
          <button
            disabled={!activeComponent || providerOffline}
            type="button"
            onClick={() => {
              if (activeComponent) assetProvider.demo.bumpRevision(activeComponent.assetKey)
            }}
          >
            模拟组件源 revision 更新
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !providerOffline
              assetProvider.demo.setOffline(next)
              setProviderOffline(next)
            }}
          >
            {providerOffline ? '恢复 Provider 在线' : '模拟 Provider 离线'}
          </button>
          <span role="status">{providerOffline ? 'Provider 离线' : 'Provider 在线'}</span>
        </section>
      ) : null}
    </>
  )
}
