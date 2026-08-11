import { CommandPanelWithActions } from './command-panel-actions'
import { createComposeEditorActionHandlers } from './action-catalog'
import type { ComposeEditorActionHandlerContext } from './action-catalog'
import { ComposeComponentPalette } from '@compose-ui/stage'
import {
  createStageInteractionController,
  createStageSceneIndex,
  getEntityWorldBounds,
  unionRects,
  zoomViewportAt,
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
  useLayoutEffect,
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
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import type {
  ComposeSceneTreeNode,
  ComposeSceneTreeOperation,
  ComposeSceneTreeProps,
} from '@compose-ui/scene-tree'
import type {
  ComposeStageDelegatableAction,
  ComposeStageProps,
  ComposeStageMarqueeMode,
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
import { planSceneOperation } from './scene-operations'
import {
  ViewportBoundStage,
} from './viewport-bound-panels'
import { DefaultStageToolbar } from '../stage-toolbar'
import { createViewportStore } from './viewport-store'
import { useComposeEditorLayout } from './use-layout-runtime'

type InspectionTarget = 'entities' | 'output' | null
type ShapeDrawingTool = 'draw-rectangle' | 'draw-line' | 'draw-arrow' | 'draw-circle'

function isShapeDrawingTool(tool: ComposeStageTool): tool is ShapeDrawingTool {
  return tool === 'draw-rectangle'
    || tool === 'draw-line'
    || tool === 'draw-arrow'
    || tool === 'draw-circle'
}

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
  /** 当前页面实例的 setup 返回作用域；用于 Stage value 绑定与 Inspector 候选。 */
  readonly scriptScope?: ComposePageScriptScope
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
  /**
   * 当前 Stage 视口会话状态。
   *
   * @remarks
   * 读取始终返回最新快照，但视口是外部状态源：读取它的组件不会因为平移或缩放自动重渲。
   * 需要跟随视口变化重渲的宿主请使用 `useComposeStageViewport`。
   */
  readonly viewport: StageViewport
  /**
   * 订阅视口变化。
   *
   * @param listener - 视口快照变化后的回调。
   * @returns 取消订阅函数。
   */
  readonly subscribeViewport: (listener: () => void) => () => void
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
 * 订阅 controller 的 Stage 视口。
 *
 * @remarks
 * 视口是编辑器会话状态中变化最频繁的一项：一次平移手势每帧都会更新它。为了让平移不牵动
 * 场景树、Inspector 等无关面板，它被存放在外部状态源里，只有订阅方会随之重渲。默认工作区的
 * Stage 与工具栏已经内建订阅；只有自己渲染 `ComposeStage` 或要显示缩放读数的宿主需要这个 Hook。
 *
 * @param controller - `useComposeEditorController` 返回的 controller。
 * @returns 当前视口快照，并在视口变化时触发重渲。
 * @example
 * ```tsx
 * const viewport = useComposeStageViewport(controller)
 * return <ComposeStage {...controller.stageProps} viewport={viewport} />
 * ```
 * @public
 */
export function useComposeStageViewport(controller: ComposeEditorController): StageViewport {
  const getSnapshot = useCallback(() => controller.viewport, [controller])
  return useSyncExternalStore(controller.subscribeViewport, getSnapshot, getSnapshot)
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
  scriptScope,
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
  const [viewportStore] = useState(() => createViewportStore(initialViewport))
  const setViewport = viewportStore.setViewport
  const [tool, setToolState] = useState<ComposeStageTool>(initialTool)
  const [lastShapeTool, setLastShapeTool] = useState<ShapeDrawingTool>(
    () => isShapeDrawingTool(initialTool) ? initialTool : 'draw-rectangle',
  )
  // 框选判定模式是会话偏好而非文档数据，事实来源留在编辑器，Stage 只接收受控值。
  const [marqueeMode, setMarqueeMode] = useState<ComposeStageMarqueeMode>('intersect')
  const setTool = useCallback((nextTool: ComposeStageTool) => {
    if (isShapeDrawingTool(nextTool)) setLastShapeTool(nextTool)
    setToolState(nextTool)
  }, [])
  const [surfaceSize, setSurfaceSize] = useState<{
    readonly width: number
    readonly height: number
  } | null>(null)
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false)
  // 网格显示是 Stage 会话偏好；只影响视觉，不进入文档与撤销历史。
  const [gridVisible, setGridVisible] = useState(true)
  const [snapRestore, setSnapRestore] = useState({
    grid: document.canvas.grid.snapEnabled,
    nodes: document.canvas.smartSnap.nodes,
    guides: document.canvas.smartSnap.guides,
  })
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
    // 视口在外部状态源里，这里是渲染期写外部 store。该分支对同一个 runtime 只会写入同一个
    // initialViewport，重复执行（StrictMode 重放）结果一致，且订阅方随后就会读到新快照。
    setViewport(initialViewport)
    setPaintEditing(null)
    setPaintSampling(null)
    setGridVisible(true)
    setSnapRestore({
      grid: nextDocument.canvas.grid.snapEnabled,
      nodes: nextDocument.canvas.smartSnap.nodes,
      guides: nextDocument.canvas.smartSnap.guides,
    })
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

  // 动作上下文依赖后面才定义的 fit/zoom 回调，而 stageProps 必须先构建。用 ref 转发可以避免
  // 为了顺序重排整段控制器；回调只在 commit 之后的键盘事件里被读取，因此在 layout effect 中更新。
  const actionContextRef = useRef<ComposeEditorActionHandlerContext | null>(null)
  const runShortcutAction = useCallback((action: ComposeStageDelegatableAction) => {
    const context = actionContextRef.current
    if (!context) return false
    // 执行层在按键时才构建：既避开渲染期读取 ref，也保证拿到的是最新选区与文档。
    const handler = createComposeEditorActionHandlers(context)[action]
    // 不可用动作也算已接管：此时执行层是空操作，回退到 Stage 内建实现反而会产生不一致行为。
    handler.run()
    return true
  }, [])

  const stageProps = useMemo<ComposeStageProps>(() => ({
    document,
    layoutSnapshot: layoutState.status === 'ready' ? layoutState.snapshot : undefined,
    layoutError: layoutState.status === 'error' ? layoutState.error.message : undefined,
    layoutRuntime: layoutSession.runtime,
    registry,
    pageLoader,
    scriptScope,
    dispatch,
    // 视口不参与 memo 依赖：它是外部状态源，读取时取当前快照，订阅由渲染 Stage 的组件负责。
    // 宿主如果自己渲染 ComposeStage，需要用 useComposeStageViewport 订阅才能随平移重渲。
    get viewport() {
      return viewportStore.getSnapshot()
    },
    onViewportChange: setViewport,
    gridVisible,
    tool,
    marqueeMode,
    onToolChange: setTool,
    onShortcutAction: runShortcutAction,
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
    scriptScope,
    dispatch,
    viewportStore,
    setViewport,
    gridVisible,
    tool,
    marqueeMode,
    setTool,
    selectedIds,
    resolvedInspectionTarget,
    setSelectedIds,
    selectOutput,
    interactionController,
    nextId,
    activePaintEditing,
    activePaintSampling,
    runShortcutAction,
  ])

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
  }, [document, layoutState, setViewport, surfaceSize])
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
  // 命令目录只需要「按倍率缩放」这一个入口；视口数学留在控制器，与工具栏和键盘保持同一实现。
  const zoomByFactor = useCallback((factor: number) => {
    if (!surfaceSize) return
    const center = { x: surfaceSize.width / 2, y: surfaceSize.height / 2 }
    const current = viewportStore.getSnapshot()
    setViewport(zoomViewportAt(current, center, current.zoom * factor))
  }, [setViewport, surfaceSize, viewportStore])
  const zoomReset = useCallback(() => {
    if (!surfaceSize) return
    const center = { x: surfaceSize.width / 2, y: surfaceSize.height / 2 }
    setViewport(zoomViewportAt(viewportStore.getSnapshot(), center, 1))
  }, [setViewport, surfaceSize, viewportStore])

  const selectedEntity = selectedIds.length === 1
    ? document.entities[selectedIds[0]!]
    : undefined
  const smartSnapEnabled = document.canvas.smartSnap.nodes
    || document.canvas.smartSnap.guides
  const configureCanvas = useCallback((
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
  }), [dispatch, document.canvas.grid, nextId])
  const setGridSize = useCallback((size: number) => {
    dispatch({
      id: nextId(),
      type: BUILTIN_COMMAND_TYPES.configureCanvas,
      payload: {
        grid: {
          ...document.canvas.grid,
          stepX: size,
          stepY: size,
        },
        smartSnap: document.canvas.smartSnap,
      },
      meta: { label: `Set grid size ${size}`, source: 'stage-toolbar' },
    })
  }, [dispatch, document.canvas, nextId])
  const toggleSnap = useCallback(() => {
    const current = {
      grid: document.canvas.grid.snapEnabled,
      nodes: document.canvas.smartSnap.nodes,
      guides: document.canvas.smartSnap.guides,
    }
    const active = current.grid || current.nodes || current.guides
    if (active) setSnapRestore(current)
    const next = active
      ? { grid: false, nodes: false, guides: false }
      : snapRestore
    dispatch({
      id: nextId(),
      type: BUILTIN_COMMAND_TYPES.configureCanvas,
      payload: {
        grid: { ...document.canvas.grid, snapEnabled: next.grid },
        smartSnap: { nodes: next.nodes, guides: next.guides },
      },
      meta: { label: active ? 'Disable canvas snapping' : 'Restore canvas snapping', source: 'stage-toolbar' },
    })
  }, [dispatch, document.canvas, nextId, snapRestore])

  // 命令面板与 Stage 快捷键共用同一份上下文，同一个动作从哪个入口触发结果都一致。
  const actionContext = useMemo<ComposeEditorActionHandlerContext>(() => ({
    canRedo: snapshot.canRedo,
    canUndo: snapshot.canUndo,
    dispatch,
    document,
    fitContainer,
    fitSelection,
    idFactory: nextId,
    layoutSnapshot: layoutState.status === 'ready' ? layoutState.snapshot : null,
    redo: runtime.redo,
    selectedIds,
    setSelectedIds,
    setTool,
    toggleGridSnap: () => configureCanvas(
      !document.canvas.grid.snapEnabled,
      smartSnapEnabled,
      'Toggle grid snap',
    ),
    toggleSmartSnap: () => configureCanvas(
      document.canvas.grid.snapEnabled,
      !smartSnapEnabled,
      'Toggle smart snap',
    ),
    undo: runtime.undo,
    zoomBy: zoomByFactor,
    zoomReset,
  }), [
    dispatch,
    document,
    fitContainer,
    fitSelection,
    layoutState,
    nextId,
    runtime,
    selectedIds,
    setSelectedIds,
    setTool,
    configureCanvas,
    smartSnapEnabled,
    snapshot.canRedo,
    snapshot.canUndo,
    zoomByFactor,
    zoomReset,
  ])
  useLayoutEffect(() => {
    actionContextRef.current = actionContext
  }, [actionContext])
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
      scriptScope={scriptScope}
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
    // 读取取当前快照，不把视口带回渲染依赖；订阅由 useComposeStageViewport 提供。
    get viewport() {
      return viewportStore.getSnapshot()
    },
    subscribeViewport: viewportStore.subscribe,
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
    stage: (
      <ViewportBoundStage
        stageProps={stageProps}
        store={viewportStore}
        surfaceSize={surfaceSize}
      />
    ),
    inspectorPanel,
    commandPanel: (
      <CommandPanelWithActions
        actionContext={actionContext}
        presets={commandPresets}
        runtime={runtime}
      />
    ),
    stageToolbar: (
      <DefaultStageToolbar
        canvasSettingsOpen={canvasSettingsOpen}
        dispatch={dispatch}
        document={document}
        gridVisible={gridVisible}
        nextId={nextId}
        setCanvasSettingsOpen={setCanvasSettingsOpen}
        setGridSize={setGridSize}
        setGridVisible={setGridVisible}
        lastShapeTool={lastShapeTool}
        marqueeMode={marqueeMode}
        setMarqueeMode={setMarqueeMode}
        setTool={setTool}
        toggleSnap={toggleSnap}
        tool={tool}
      />
    ),
  }
}
