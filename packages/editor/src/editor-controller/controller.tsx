import { ComposeCommandPanel } from '@compose-ui/command-panel'
import {
  ComposeComponentPalette,
  ComposeStage,
} from '@compose-ui/stage'
import {
  createStageInteractionController,
  createStageSceneIndex,
  getEntityWorldBounds,
  unionRects,
} from '@compose-ui/stage-engine'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeComposition,
  getComposeHierarchy,
  getComposeLock,
  getComposeVisibility,
  type CommandDispatchResult,
  type ComposeDocument,
  type ComposeEntity,
  type ComposePageDocumentLoader,
  type EditorCommand,
  type EditorTransaction,
  type TransactionRuntime,
} from '@compose-ui/core'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import type { ComposeCommandPreset } from '@compose-ui/command-panel'
import type {
  ComposeEntityRegistry,
  ComposeNodeEditPort,
  ComposePaintEditPort,
} from '@compose-ui/component-registry'
import type { ComposeHistoryNavigationController } from '@compose-ui/history'
import type {
  ComposeSceneTreeNode,
  ComposeSceneTreeOperation,
  ComposeSceneTreeProps,
} from '@compose-ui/scene-tree'
import type {
  ComposeStageProps,
  ComposeStageTool,
} from '@compose-ui/stage'
import type {
  StageInteractionController,
  StagePaintEditing,
  StagePaintSampling,
  StageViewport,
} from '@compose-ui/stage-engine'
import {
  CanvasInspector,
  DefaultEmptyInspector,
  EntityInspector,
} from '../inspector'
import { DefaultStageToolbar } from '../stage-toolbar'
import { planSceneOperation } from './scene-operations'
import { useComposeEditorLayout } from './use-layout-runtime'

type InspectionTarget = 'entities' | 'output' | null

function defaultIdFactory() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `editor-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function useFinalControllerDisposal(controller: StageInteractionController) {
  const effectGeneration = useRef(0)
  useEffect(() => {
    effectGeneration.current += 1
    const mountedGeneration = effectGeneration.current
    return () => {
      // StrictMode 会同步 cleanup 后重放 setup；只在没有后续 setup 的最终卸载后永久释放。
      queueMicrotask(() => {
        if (effectGeneration.current === mountedGeneration) controller.dispose()
      })
    }
  }, [controller])
}

function sceneEntity(
  document: ComposeDocument,
  registry: ComposeEntityRegistry,
  entity: ComposeEntity,
): ComposeSceneTreeNode {
  const hierarchy = getComposeHierarchy(entity)
  const locked = getComposeLock(entity).locked
  const composition = getComposeComposition(entity)
  return {
    id: entity.id,
    label: entity.name,
    visible: getComposeVisibility(entity).visible,
    locked,
    icon: composition.presetId
      ? registry.getPreset(composition.presetId)?.icon
      : undefined,
    canHaveChildren: hierarchy !== undefined,
    canRename: !locked,
    canDelete: !locked,
    canMove: !locked,
    canToggleVisibility: true,
    canToggleLocked: true,
    ...(hierarchy
      ? {
          children: hierarchy.childIds
            .map((id) => document.entities[id])
            .filter((child): child is ComposeEntity => child !== undefined)
            .map((child) => sceneEntity(document, registry, child)),
        }
      : {}),
  }
}

function deriveSceneEntities(
  document: ComposeDocument,
  registry: ComposeEntityRegistry,
): readonly ComposeSceneTreeNode[] {
  return document.rootIds
    .map((id) => document.entities[id])
    .filter((entity): entity is ComposeEntity => entity !== undefined)
    .map((entity) => sceneEntity(document, registry, entity))
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function validSelection(document: ComposeDocument, ids: readonly string[]) {
  return unique(ids).filter((id) => {
    const entity = document.entities[id]
    return entity ? getComposeVisibility(entity).visible : false
  })
}

function validExpanded(document: ComposeDocument, ids: readonly string[]) {
  return unique(ids).filter((id) => {
    const entity = document.entities[id]
    return entity ? getComposeHierarchy(entity) !== undefined : false
  })
}

/**
 * controller 成功事务或历史导航的单一宿主观察事件。
 *
 * @public
 */
export interface ComposeEditorTransactionEvent {
  /** 当前通知对应的编辑或导航方向。 */
  readonly direction: 'commit' | 'undo' | 'redo' | 'navigate'
  /** 导航涉及多个事务时，提供离当前状态最近的一个；记录已被裁剪时为 `null`。 */
  readonly transaction: EditorTransaction | null
  /** 当前事件涉及的全部稳定事务 ID。 */
  readonly transactionIds: readonly string[]
  /** committed 使用原命令来源，历史导航固定为 `history`。 */
  readonly source: string
  /** committed 或被导航事务涉及的 Entity ID 去重集合。 */
  readonly targets: readonly string[]
}

/**
 * 编辑器 controller 的初始化依赖与会话默认值。
 *
 * @public
 */
export interface UseComposeEditorControllerOptions {
  /** 所有编辑入口共享的正式文档与历史运行时。 */
  readonly runtime: TransactionRuntime
  /** Palette、Stage、Inspector 共用的实例级 Entity 注册表。 */
  readonly registry: ComposeEntityRegistry
  /** 初始选择；不会写入文档历史。 */
  readonly initialSelection?: readonly string[]
  /** 初始场景树展开项；不会写入文档历史。 */
  readonly initialExpandedIds?: readonly string[]
  /** 初始无限 Stage 视口。 @defaultValue `{ x: 80, y: 64, zoom: 1 }` */
  readonly initialViewport?: StageViewport
  /** 初始 Stage 工具。 @defaultValue `"select"` */
  readonly initialTool?: ComposeStageTool
  /** ComposeCommandPanel 显示的结构化命令预设。 */
  readonly commandPresets?: readonly ComposeCommandPreset[]
  /**
   * 场景树与工具栏“新建容器”使用的 Entity Preset ID。
   *
   * @remarks
   * Registry 中必须存在该 Preset（默认物料由 `@compose-ui/materials` 的
   * `createComposeBasicMaterials` 提供）；缺失时创建入口会失败并输出警告。
   *
   * @defaultValue `"container"`
   */
  readonly containerPresetId?: string
  /** 成功事务和成功历史导航的唯一外部审计边界。 */
  readonly onTransaction?: (
    event: ComposeEditorTransactionEvent,
  ) => void | Promise<void>
  /** controller 创建 Entity 和命令时使用的稳定 ID factory。 */
  readonly idFactory?: () => string
  /**
   * 节点引用属性的候选来源。
   *
   * @remarks
   * 由宿主从页面 Store 派生（见 `useComposePageCatalog` 与 `useNodeEditorPort`）；未提供时
   * node 字段呈现无候选状态但仍可清空。
   */
  readonly nodeEditPort?: ComposeNodeEditPort
  /**
   * 页面型物料使用的文档加载端口。
   *
   * @remarks
   * 由宿主从页面 Store 派生（`createComposePageDocumentLoader`）；未提供时画布上的页面槽位
   * 呈现占位状态。
   */
  readonly pageLoader?: ComposePageDocumentLoader
}

/**
 * `ComposeEditor` 默认工作区消费的受控组合结果。
 *
 * @public
 */
export interface ComposeEditorController {
  /** 当前正式文档；直接来自 runtime 快照。 */
  readonly document: ComposeDocument
  /** controller 使用的事务运行时，同时驱动默认 ComposeHistoryPanel。 */
  readonly runtime: TransactionRuntime
  /** controller 使用的 Entity 注册表。 */
  readonly registry: ComposeEntityRegistry
  /** 结构兼容 `ComposeHistoryNavigationController` 的事务历史。 */
  readonly history: ComposeHistoryNavigationController
  /** 当前有效且可见的选择。 */
  readonly selectedIds: readonly string[]
  /** 当前有效容器展开项。 */
  readonly expandedIds: readonly string[]
  /** 当前 Stage 视口会话状态。 */
  readonly viewport: StageViewport
  /** 当前选择或平移工具。 */
  readonly tool: ComposeStageTool
  /** 当前实例 Palette 与 Stage 共享的无 UI 交互控制器。 */
  readonly interactionController: StageInteractionController
  /** 替换当前选择。 */
  readonly setSelectedIds: (ids: readonly string[]) => void
  /** 替换场景树展开项。 */
  readonly setExpandedIds: (ids: readonly string[]) => void
  /** 替换 Stage 视口。 */
  readonly setViewport: (viewport: StageViewport) => void
  /** 替换 Stage 工具。 */
  readonly setTool: (tool: ComposeStageTool) => void
  /** 向同一 runtime 派发结构化命令。 */
  readonly dispatch: (command: EditorCommand) => CommandDispatchResult
  /** 默认 ComposeSceneTree 的完整受控属性。 */
  readonly sceneTreeProps: ComposeSceneTreeProps
  /** 默认 Stage 的完整受控属性。 */
  readonly stageProps: ComposeStageProps
  /** 默认 Entity Preset Library 内容。 */
  readonly componentLibraryPanel: ReactNode
  /** 默认中央 Stage 内容。 */
  readonly stage: ReactNode
  /** 默认聚合 Entity Inspector 内容。 */
  readonly inspectorPanel: ReactNode
  /** 默认 ComposeCommandPanel 内容。 */
  readonly commandPanel: ReactNode
  /** 默认 Stage 工具栏内容。 */
  readonly stageToolbar: ReactNode
}

function invokeObserver(
  observer: UseComposeEditorControllerOptions['onTransaction'],
  event: ComposeEditorTransactionEvent,
) {
  if (!observer) return
  try {
    const pending = observer(event)
    if (pending && typeof pending.then === 'function') void pending.catch(() => undefined)
  }
  catch {
    // 宿主审计是已提交事务后的副作用；同步异常也不能影响文档与历史。
  }
}

/**
 * 把 runtime、registry 与编辑器会话状态组合成默认工作区 controller。
 *
 * @remarks
 * Hook 不复制 ComposeDocument。文档变更始终先进入 runtime，再由所有派生视图读取同一个快照。
 *
 * @param options - 正式运行时、注册表、会话默认值和可选审计 observer。
 * @returns 可直接传给 `ComposeEditor` 的 controller。
 * @public
 */
export function useComposeEditorController({
  runtime,
  registry,
  initialSelection = [],
  initialExpandedIds = [],
  initialViewport = { x: 80, y: 64, zoom: 1 },
  initialTool = 'select',
  commandPresets,
  containerPresetId = 'container',
  onTransaction,
  idFactory = defaultIdFactory,
  nodeEditPort,
  pageLoader,
}: UseComposeEditorControllerOptions): ComposeEditorController {
  // Layout 订阅先于文档订阅建立，保证同一次事务的 document/Snapshot 成对发布。
  const layoutSession = useComposeEditorLayout(runtime)
  const layoutState = layoutSession.state
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const document = snapshot.document
  const [selectedIds, setSelectedIdsState] = useState<readonly string[]>(() =>
    validSelection(document, initialSelection))
  const [inspectionTarget, setInspectionTarget] = useState<InspectionTarget>(() =>
    validSelection(document, initialSelection).length > 0 ? 'entities' : null)
  const [expandedIds, setExpandedIdsState] = useState<readonly string[]>(() =>
    validExpanded(document, initialExpandedIds))
  const [viewport, setViewport] = useState<StageViewport>(initialViewport)
  const [tool, setTool] = useState<ComposeStageTool>(initialTool)
  const [surfaceSize, setSurfaceSize] = useState<{
    readonly width: number
    readonly height: number
  } | null>(null)
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false)
  // Paint 编辑与图层取色都是 Editor 会话状态：它们只协调 Inspector 和 Stage，
  // 不进入 ComposeDocument、事务历史或 operation log。
  const [paintEditing, setPaintEditing] = useState<StagePaintEditing | null>(null)
  const [paintSampling, setPaintSampling] = useState<StagePaintSampling | null>(null)
  const [interactionController] = useState(createStageInteractionController)
  const transactionById = useRef(new Map<string, EditorTransaction>())
  const observerRef = useRef(onTransaction)
  const idFactoryRef = useRef(idFactory)
  const [observedRuntime, setObservedRuntime] = useState(runtime)

  // 会话状态是文档作用域的：选择、检视目标、展开集合与视口都以实体 ID 或该文档的坐标表达。
  // 宿主换用另一个 runtime（例如切换到另一个页面）时必须立即重置，否则会残留指向上一份
  // 文档的选择与视口。这里用「prop 变化时在渲染期调整 state」的标准模式，而不是 Effect，
  // 避免先用陈旧会话状态渲染一帧。
  if (runtime !== observedRuntime) {
    setObservedRuntime(runtime)
    const nextDocument = runtime.getState().document
    setSelectedIdsState(validSelection(nextDocument, []))
    setInspectionTarget(null)
    setExpandedIdsState(validExpanded(nextDocument, []))
    setViewport(initialViewport)
    setPaintEditing(null)
    setPaintSampling(null)
    // 进行中的手势属于上一份文档，必须取消而不是让它落到新文档的实体上；
    // Pointer 与外部拖入是两条独立的进行中状态，各自都要终止。
    interactionController.send({ type: 'pointer.cancel' })
    interactionController.send({ type: 'external.cancel' })
  }

  useEffect(() => {
    observerRef.current = onTransaction
  }, [onTransaction])
  useEffect(() => {
    idFactoryRef.current = idFactory
  }, [idFactory])
  useFinalControllerDisposal(interactionController)

  useEffect(() => {
    const cleanupSession = (nextDocument: ComposeDocument) => {
      setSelectedIdsState((current) => validSelection(nextDocument, current))
      setExpandedIdsState((current) => validExpanded(nextDocument, current))
    }
    return runtime.subscribeEvents((event) => {
      if (event.type === 'committed') {
        cleanupSession(runtime.document)
        transactionById.current.set(event.transaction.id, event.transaction)
        invokeObserver(observerRef.current, {
          direction: 'commit',
          transaction: event.transaction,
          transactionIds: [event.transaction.id],
          source: event.transaction.source ?? event.command.meta?.source ?? 'runtime',
          targets: unique(event.transaction.targetIds),
        })
        return
      }
      if (event.type === 'history-navigation') {
        cleanupSession(event.document)
        const transactions = event.transactionIds
          .map((id) => transactionById.current.get(id))
          .filter((item): item is EditorTransaction => item !== undefined)
        invokeObserver(observerRef.current, {
          direction: event.direction,
          transaction: transactions[0] ?? null,
          transactionIds: event.transactionIds,
          source: 'history',
          targets: unique(transactions.flatMap((transaction) => transaction.targetIds)),
        })
        return
      }
      if (event.type === 'reset') {
        transactionById.current.clear()
        cleanupSession(event.document)
      }
    })
  }, [runtime])

  const setSelectedIds = useCallback((ids: readonly string[]) => {
    const next = unique(ids)
    setSelectedIdsState(next)
    setInspectionTarget(next.length > 0 ? 'entities' : null)
    if (next.length !== 1) {
      setPaintEditing(null)
      setPaintSampling(null)
    }
  }, [])
  const selectOutput = useCallback(() => {
    setSelectedIdsState([])
    setInspectionTarget('output')
    setPaintEditing(null)
    setPaintSampling(null)
  }, [])
  const resolvedInspectionTarget = inspectionTarget === 'entities'
    && selectedIds.length === 0
    ? null
    : inspectionTarget
  const setExpandedIds = useCallback((ids: readonly string[]) => {
    setExpandedIdsState(unique(ids))
  }, [])
  const dispatch = useCallback(
    (command: EditorCommand) => runtime.dispatch(command),
    [runtime],
  )
  const nextId = useCallback(() => idFactoryRef.current(), [])
  const paintEditPort = useMemo<ComposePaintEditPort>(() => ({
    open: ({ entityId }) => {
      if (!document.entities[entityId]) return
      setPaintSampling(null)
      setPaintEditing({ entityId })
    },
    close: () => {
      setPaintSampling(null)
      setPaintEditing(null)
    },
    sample: (target) => {
      if (!document.entities[target.entityId]) return
      setPaintSampling(target)
    },
  }), [document.entities])

  // 选择变化无需在 effect 中再写一次状态；Stage 只接收与当前单选目标一致的会话，
  // 因而不兼容的 Paint 手势会由 engine 立即取消，也避免 React 产生级联渲染。
  const activePaintEditing = selectedIds.length === 1 && paintEditing?.entityId === selectedIds[0]
    ? paintEditing
    : null
  const activePaintSampling = selectedIds.length === 1 && paintSampling?.entityId === selectedIds[0]
    ? paintSampling
    : null

  const onSceneOperation = useCallback((operation: ComposeSceneTreeOperation) => {
    const result = planSceneOperation(operation, {
      document,
      layoutSnapshot: layoutState.status === 'ready' ? layoutState.snapshot : null,
      registry,
      containerPresetId,
      nextId,
    })
    if (result.status === 'unavailable') {
      // 宿主配置缺失时静默失败会让入口看起来“坏了”却无从排查。
      console.warn(`[compose-editor] ${result.reason}`)
      return
    }
    if (result.status === 'skipped') return
    const dispatched = runtime.dispatch(result.plan.command)
    if (dispatched.status === 'committed' && result.plan.nextSelection) {
      setSelectedIds(result.plan.nextSelection)
    }
  }, [containerPresetId, document, layoutState, nextId, registry, runtime, setSelectedIds])

  const sceneTreeProps = useMemo<ComposeSceneTreeProps>(() => ({
    nodes: deriveSceneEntities(document, registry),
    selectedIds,
    expandedIds,
    onSelectionChange: setSelectedIds,
    onExpandedChange: setExpandedIds,
    onOperation: onSceneOperation,
  }), [
    document,
    registry,
    selectedIds,
    expandedIds,
    setSelectedIds,
    setExpandedIds,
    onSceneOperation,
  ])

  const stageProps = useMemo<ComposeStageProps>(() => ({
    document,
    layoutSnapshot: layoutState.status === 'ready' ? layoutState.snapshot : undefined,
    layoutError: layoutState.status === 'error' ? layoutState.error.message : undefined,
    layoutRuntime: layoutSession.runtime,
    registry,
    pageLoader,
    dispatch,
    viewport,
    onViewportChange: setViewport,
    tool,
    onToolChange: setTool,
    selectedIds,
    onSelectedIdsChange: setSelectedIds,
    outputSelected: resolvedInspectionTarget === 'output',
    onOutputSelect: selectOutput,
    onSurfaceSizeChange: setSurfaceSize,
    interactionController,
    paintEditing: activePaintEditing,
    paintSampling: activePaintSampling,
    onPaintSamplingComplete: () => setPaintSampling(null),
    idFactory: nextId,
  }), [
    document,
    layoutState,
    layoutSession.runtime,
    registry,
    pageLoader,
    dispatch,
    viewport,
    tool,
    selectedIds,
    resolvedInspectionTarget,
    setSelectedIds,
    selectOutput,
    interactionController,
    nextId,
    activePaintEditing,
    activePaintSampling,
  ])

  const createContainer = useCallback(() => {
    onSceneOperation({
      type: 'create',
      parentId: null,
      index: document.rootIds.length,
    })
  }, [document.rootIds.length, onSceneOperation])
  const fitBounds = useCallback((ids: readonly string[]) => {
    if (!surfaceSize || layoutState.status !== 'ready') return
    const bounds = unionRects(
      ids
        .filter((id) => document.entities[id] !== undefined)
        .map((id) => getEntityWorldBounds(document, layoutState.snapshot, id)),
    )
    if (!bounds) return
    const { width, height } = surfaceSize
    const zoom = Math.min(
      8,
      Math.max(0.1, Math.min((width - 128) / bounds.width, (height - 128) / bounds.height)),
    )
    setViewport({
      x: width / 2 - (bounds.x + bounds.width / 2) * zoom,
      y: height / 2 - (bounds.y + bounds.height / 2) * zoom,
      zoom,
    })
  }, [document, layoutState, surfaceSize])
  const sceneIndex = useMemo(
    () => layoutState.status === 'ready'
      ? createStageSceneIndex(document, layoutState.snapshot)
      : null,
    [document, layoutState],
  )
  const fitContainer = useCallback(() => {
    const selectedContainerId = selectedIds.length === 1
      && document.entities[selectedIds[0]!]
      && getComposeHierarchy(document.entities[selectedIds[0]!]!)
      ? selectedIds[0]!
      : sceneIndex?.commonContainerForSelection(selectedIds)
    if (selectedContainerId) fitBounds([selectedContainerId])
  }, [document.entities, fitBounds, sceneIndex, selectedIds])
  const fitSelection = useCallback(() => fitBounds(selectedIds), [fitBounds, selectedIds])

  const selectedEntity = selectedIds.length === 1
    ? document.entities[selectedIds[0]!]
    : undefined
  const selectedContainerId = selectedIds.length === 1
    && selectedEntity
    && getComposeHierarchy(selectedEntity)
    ? selectedEntity.id
    : sceneIndex?.commonContainerForSelection(selectedIds)
  const smartSnapEnabled = document.canvas.smartSnap.nodes
    || document.canvas.smartSnap.guides
  const configureCanvas = (
    gridSnapEnabled: boolean,
    smartEnabled: boolean,
    label: string,
  ) => dispatch({
    id: nextId(),
    type: BUILTIN_COMMAND_TYPES.configureCanvas,
    payload: {
      grid: {
        ...document.canvas.grid,
        snapEnabled: gridSnapEnabled,
      },
      smartSnap: {
        nodes: smartEnabled,
        guides: smartEnabled,
      },
    },
    meta: { label, source: 'stage-toolbar' },
  })

  // Inspector 目标只有画布输出、单选 Entity 和空态三种；三者互斥且由会话状态决定。
  const inspectorPanel = resolvedInspectionTarget === 'output' ? (
    // 输出配置会在色盘拖动的每个采样点更新。不能以输出值作为 key，
    // 否则会卸载活跃的 ColorPicker 并中断原生 pointer 手势。
    <CanvasInspector
      dispatch={dispatch}
      document={document}
      idFactory={nextId}
    />
  ) : selectedEntity ? (
    <EntityInspector
      dispatch={dispatch}
      document={document}
      entity={selectedEntity}
      idFactory={nextId}
      layoutSnapshot={layoutState.status === 'ready' ? layoutState.snapshot : undefined}
      // 按 Entity 重挂载：能力移除确认等局部会话状态不得跨选中目标残留。
      key={selectedEntity.id}
      nodeEditPort={nodeEditPort}
      paintEditPort={paintEditPort}
      registry={registry}
    />
  ) : (
    <DefaultEmptyInspector />
  )

  return {
    document,
    runtime,
    registry,
    history: runtime,
    selectedIds,
    expandedIds,
    viewport,
    tool,
    interactionController,
    setSelectedIds,
    setExpandedIds,
    setViewport,
    setTool,
    dispatch,
    sceneTreeProps,
    stageProps,
    componentLibraryPanel: (
      <ComposeComponentPalette
        interactionController={interactionController}
        registry={registry}
      />
    ),
    stage: <ComposeStage {...stageProps} />,
    inspectorPanel,
    commandPanel: (
      <ComposeCommandPanel presets={commandPresets} runtime={runtime} />
    ),
    stageToolbar: (
      <DefaultStageToolbar
        canvasSettingsOpen={canvasSettingsOpen}
        configureCanvas={configureCanvas}
        createContainer={createContainer}
        dispatch={dispatch}
        document={document}
        fitContainer={fitContainer}
        fitSelection={fitSelection}
        nextId={nextId}
        selectedContainerId={selectedContainerId ?? null}
        selectedIds={selectedIds}
        setCanvasSettingsOpen={setCanvasSettingsOpen}
        setTool={setTool}
        setViewport={setViewport}
        smartSnapEnabled={smartSnapEnabled}
        surfaceSize={surfaceSize}
        tool={tool}
        viewport={viewport}
      />
    ),
  }
}
