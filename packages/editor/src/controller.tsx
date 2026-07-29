import { ComposeCommandPanel } from '@compose-ui/command-panel'
import {
  ComposeComponentPalette,
  ComposeStage,
} from '@compose-ui/stage'
import {
  createDuplicateCommand,
  createReparentCommand,
  createStageInteractionController,
  createStageSceneIndex,
  getEntityParentId,
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
  type ComposeTransform,
  type EditorCommand,
  type EditorTransaction,
  type JsonValue,
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
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
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
  StageViewport,
} from '@compose-ui/stage-engine'
import {
  DefaultEmptyInspector,
  DefaultStageToolbar,
} from './default-workspace-content'
import { CanvasInspector } from './canvas-inspector'
import { EntityInspector } from './entity-inspector'

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

function describeEntityTargets(document: ComposeDocument, entityIds: readonly string[]) {
  if (entityIds.length === 1) return document.entities[entityIds[0]!]?.name ?? 'entity'
  return `${entityIds.length} entities`
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
  /** 成功事务和成功历史导航的唯一外部审计边界。 */
  readonly onTransaction?: (
    event: ComposeEditorTransactionEvent,
  ) => void | Promise<void>
  /** controller 创建 Entity 和命令时使用的稳定 ID factory。 */
  readonly idFactory?: () => string
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

function entityFromSeed(
  id: string,
  seed: { readonly name: string; readonly components: ComposeEntity['components'] },
  transform: ComposeTransform,
): ComposeEntity {
  return {
    id,
    name: seed.name,
    components: {
      ...seed.components,
      Transform: transform,
    },
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
  onTransaction,
  idFactory = defaultIdFactory,
}: UseComposeEditorControllerOptions): ComposeEditorController {
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
  const [interactionController] = useState(createStageInteractionController)
  const transactionById = useRef(new Map<string, EditorTransaction>())
  const observerRef = useRef(onTransaction)
  const idFactoryRef = useRef(idFactory)

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
  }, [])
  const selectOutput = useCallback(() => {
    setSelectedIdsState([])
    setInspectionTarget('output')
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

  const onSceneOperation = useCallback((operation: ComposeSceneTreeOperation) => {
    let editorCommand: EditorCommand | null = null
    let nextSelection: readonly string[] | null = null
    if (operation.type === 'create') {
      const created = registry.createSeed('container')
      if (!created.ok) return
      const entityId = nextId()
      const rootOffset = 80 + document.rootIds.length * 40
      const initial = created.seed.components.Transform as ComposeTransform
      const transform: ComposeTransform = {
        ...initial,
        position: operation.parentId === null
          ? { x: rootOffset, y: rootOffset }
          : { x: 0, y: 0 },
        size: operation.parentId === null
          ? initial.size
          : { width: 320, height: 180 },
      }
      const entity = entityFromSeed(entityId, created.seed, transform)
      editorCommand = {
        id: nextId(),
        type: BUILTIN_COMMAND_TYPES.createEntity,
        payload: {
          entity: entity as unknown as JsonValue,
          parentId: operation.parentId,
          index: operation.index,
        },
        meta: {
          label: operation.parentId === null
            ? `Create Container · ${transform.size.width} × ${transform.size.height}`
            : 'Create Container · 320 × 180',
          source: 'scene-tree',
          targetIds: [entityId],
        },
      }
      nextSelection = [entityId]
    }
    else if (operation.type === 'rename') {
      const previousName = document.entities[operation.nodeId]?.name ?? 'entity'
      editorCommand = {
        id: nextId(),
        type: BUILTIN_COMMAND_TYPES.renameEntity,
        payload: { entityId: operation.nodeId, name: operation.label },
        meta: {
          label: `Rename ${previousName} · “${previousName}” → “${operation.label}”`,
          source: 'scene-tree',
          targetIds: [operation.nodeId],
        },
      }
    }
    else if (operation.type === 'delete') {
      editorCommand = {
        id: nextId(),
        type: BUILTIN_COMMAND_TYPES.deleteEntity,
        payload: { entityIds: operation.nodeIds },
        meta: {
          label: `Delete ${describeEntityTargets(document, operation.nodeIds)}`,
          source: 'scene-tree',
          targetIds: operation.nodeIds,
        },
      }
    }
    else if (operation.type === 'set-visibility') {
      editorCommand = {
        id: nextId(),
        type: BUILTIN_COMMAND_TYPES.setVisibility,
        payload: { entityIds: operation.nodeIds, visible: operation.visible },
        meta: {
          label: `${operation.visible ? 'Show' : 'Hide'} `
            + describeEntityTargets(document, operation.nodeIds),
          source: 'scene-tree',
          targetIds: operation.nodeIds,
        },
      }
    }
    else if (operation.type === 'set-locked') {
      editorCommand = {
        id: nextId(),
        type: BUILTIN_COMMAND_TYPES.setLock,
        payload: { entityIds: operation.nodeIds, locked: operation.locked },
        meta: {
          label: `${operation.locked ? 'Lock' : 'Unlock'} `
            + describeEntityTargets(document, operation.nodeIds),
          source: 'scene-tree',
          targetIds: operation.nodeIds,
        },
      }
    }
    else if (operation.type === 'move') {
      const crossesParent = operation.nodeIds.some(
        (id) => getEntityParentId(document, id) !== operation.parentId,
      )
      editorCommand = crossesParent
        ? createReparentCommand(
            document,
            operation.nodeIds,
            operation.parentId,
            operation.index,
            nextId(),
          )
        : {
            id: nextId(),
            type: BUILTIN_COMMAND_TYPES.moveEntity,
            payload: {
              entityIds: operation.nodeIds,
              parentId: operation.parentId,
              index: operation.index,
            },
            meta: {
              label: `Reorder ${describeEntityTargets(document, operation.nodeIds)}`
                + ` · position ${operation.index + 1}`,
              source: 'scene-tree',
              targetIds: operation.nodeIds,
            },
          }
    }
    else if (operation.type === 'duplicate') {
      const duplicates = operation.sourceNodeIds
        .map((id) => createDuplicateCommand(document, id, nextId, nextId()))
        .filter((item): item is NonNullable<typeof item> => item !== null)
      if (duplicates.length === 1) editorCommand = duplicates[0]!.command
      else if (duplicates.length > 1) {
        editorCommand = {
          id: nextId(),
          type: BUILTIN_COMMAND_TYPES.batch,
          payload: {
            commands: duplicates.map((item) => item.command) as unknown as JsonValue,
          },
          meta: {
            label: `Duplicate ${describeEntityTargets(document, operation.sourceNodeIds)}`,
            source: 'scene-tree',
            targetIds: operation.sourceNodeIds,
          },
        }
      }
      nextSelection = duplicates.map((item) => item.rootId)
    }
    if (!editorCommand) return
    const result = runtime.dispatch(editorCommand)
    if (result.status === 'committed' && nextSelection) setSelectedIds(nextSelection)
  }, [document, nextId, registry, runtime, setSelectedIds])

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
    registry,
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
    idFactory: nextId,
  }), [
    document,
    registry,
    dispatch,
    viewport,
    tool,
    selectedIds,
    resolvedInspectionTarget,
    setSelectedIds,
    selectOutput,
    interactionController,
    nextId,
  ])

  const createContainer = useCallback(() => {
    onSceneOperation({
      type: 'create',
      parentId: null,
      index: document.rootIds.length,
    })
  }, [document.rootIds.length, onSceneOperation])
  const fitBounds = useCallback((ids: readonly string[]) => {
    if (!surfaceSize) return
    const bounds = unionRects(
      ids
        .filter((id) => document.entities[id] !== undefined)
        .map((id) => getEntityWorldBounds(document, id)),
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
  }, [document, surfaceSize])
  const sceneIndex = useMemo(() => createStageSceneIndex(document), [document])
  const fitContainer = useCallback(() => {
    const selectedContainerId = selectedIds.length === 1
      && document.entities[selectedIds[0]!]
      && getComposeHierarchy(document.entities[selectedIds[0]!]!)
      ? selectedIds[0]!
      : sceneIndex.commonContainerForSelection(selectedIds)
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
    : sceneIndex.commonContainerForSelection(selectedIds)
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
    inspectorPanel: resolvedInspectionTarget === 'output' ? (
      <CanvasInspector
        key={[
          document.output.width,
          document.output.height,
          document.output.backgroundColor,
        ].join(':')}
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
        registry={registry}
      />
    ) : (
      <DefaultEmptyInspector />
    ),
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
        selectedContainerId={selectedContainerId}
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
