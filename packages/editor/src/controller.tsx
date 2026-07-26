import { ComposeCommandPanel } from '@compose-ui/command-panel'
import { ComposeRegistryInspector } from '@compose-ui/component-registry'
import {
  ComposeComponentPalette,
  ComposeStage,
} from '@compose-ui/stage'
import {
  createDuplicateCommand,
  createReparentCommand,
  createStageSceneIndex,
  createStageInteractionController,
  getNodeParentId,
  getNodeWorldBounds,
  unionRects,
} from '@compose-ui/stage-engine'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ComponentType, ReactNode } from 'react'
import type {
  ComposeCommandPreset,
} from '@compose-ui/command-panel'
import type {
  ComposeComponentRegistry,
  ComposeNodeInspectorProps,
} from '@compose-ui/component-registry'
import type {
  CommandDispatchResult,
  ComposeDocument,
  ComposeFrameNode,
  ComposeNode,
  EditorCommand,
  EditorTransaction,
  JsonValue,
  TransactionRuntime,
} from '@compose-ui/core'
import type { ComposeHistoryNavigationController } from '@compose-ui/history'
import type {
  ComposeSceneTreeNode,
  ComposeSceneTreeOperation,
  ComposeSceneTreeProps,
} from '@compose-ui/scene-tree'
import type {
  ComposeStageFramePreset,
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

type InspectionTarget = 'nodes' | 'output' | null

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

function sceneNode(
  document: ComposeDocument,
  registry: ComposeComponentRegistry,
  node: ComposeNode,
): ComposeSceneTreeNode {
  const common = {
    id: node.id,
    label: node.name,
    visible: node.visible,
    locked: node.locked,
    canHaveChildren: node.kind !== 'component',
    canRename: !node.locked,
    canDelete: !node.locked,
    canMove: !node.locked,
    canToggleVisibility: true,
    canToggleLocked: true,
  }
  if (node.kind === 'component') {
    return {
      ...common,
      icon: registry.get(node.componentType)?.icon,
      canHaveChildren: false,
    }
  }
  return {
    ...common,
    children: node.childIds
      .map((id) => document.nodes[id])
      .filter((child): child is ComposeNode => child !== undefined)
      .map((child) => sceneNode(document, registry, child)),
  }
}

function deriveSceneNodes(
  document: ComposeDocument,
  registry: ComposeComponentRegistry,
): readonly ComposeSceneTreeNode[] {
  return document.rootIds
    .map((id) => document.nodes[id])
    .filter((node): node is ComposeNode => node !== undefined)
    .map((node) => sceneNode(document, registry, node))
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function validSelection(document: ComposeDocument, ids: readonly string[]) {
  return unique(ids).filter((id) => Boolean(document.nodes[id]?.visible))
}

function validExpanded(document: ComposeDocument, ids: readonly string[]) {
  return unique(ids).filter((id) => {
    const node = document.nodes[id]
    return node?.kind === 'frame'
  })
}

function describeNodeTargets(document: ComposeDocument, nodeIds: readonly string[]) {
  if (nodeIds.length === 1) return document.nodes[nodeIds[0]!]?.name ?? 'node'
  return `${nodeIds.length} nodes`
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
  /** committed 或被导航事务涉及的节点 ID 去重集合。 */
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
  /** Palette、Stage、Inspector 共用的实例级组件注册表。 */
  readonly registry: ComposeComponentRegistry
  /** 显示在组件 definitions 之前的根级 Frame 预设。 */
  readonly framePresets?: readonly ComposeStageFramePreset[]
  /** Frame 单选时使用的公共容器 Inspector。 */
  readonly containerInspector?: ComponentType<
    ComposeNodeInspectorProps<ComposeFrameNode>
  >
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
  /** controller 创建节点和命令时使用的稳定 ID factory。 */
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
  /** controller 使用的组件注册表。 */
  readonly registry: ComposeComponentRegistry
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
  /** 默认 Component Library 内容。 */
  readonly componentLibraryPanel: ReactNode
  /** 默认中央 Stage 内容。 */
  readonly stage: ReactNode
  /** 默认 definition Inspector 内容。 */
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
  framePresets = [],
  containerInspector: ContainerInspector,
  initialSelection = [],
  initialExpandedIds = [],
  initialViewport = { x: 80, y: 64, zoom: 1 },
  initialTool = 'select',
  commandPresets,
  onTransaction,
  idFactory = defaultIdFactory,
}: UseComposeEditorControllerOptions): ComposeEditorController {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getState,
    runtime.getState,
  )
  const document = snapshot.document
  const [selectedIds, setSelectedIdsState] = useState<readonly string[]>(() =>
    validSelection(document, initialSelection))
  const [inspectionTarget, setInspectionTarget] = useState<InspectionTarget>(() =>
    validSelection(document, initialSelection).length > 0 ? 'nodes' : null)
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
    setInspectionTarget(next.length > 0 ? 'nodes' : null)
  }, [])
  const selectOutput = useCallback(() => {
    setSelectedIdsState([])
    setInspectionTarget('output')
  }, [])
  const resolvedInspectionTarget = inspectionTarget === 'nodes'
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
    let command: EditorCommand | null = null
    let nextSelection: readonly string[] | null = null
    if (operation.type === 'create') {
      const nodeId = nextId()
      const rootOffset = 80 + document.rootIds.length * 40
      command = {
        id: nextId(),
        type: 'node.create',
        payload: {
          node: {
            id: nodeId,
            kind: 'frame',
            name: 'Frame',
            visible: true,
            locked: false,
            transform: operation.parentId === null
              ? {
                  x: rootOffset,
                  y: rootOffset,
                  width: 1280,
                  height: 720,
                  rotation: 0,
                }
              : { x: 0, y: 0, width: 320, height: 180, rotation: 0 },
            childIds: [],
            clipContent: true,
          },
          parentId: operation.parentId,
          index: operation.index,
        },
        meta: {
          label: operation.parentId === null
            ? `Create Frame · 1280 × 720 at (${rootOffset}, ${rootOffset})`
            : 'Create Frame · 320 × 180 at (0, 0)',
          source: 'scene-tree',
          targetIds: [nodeId],
        },
      }
      nextSelection = [nodeId]
    }
    else if (operation.type === 'rename') {
      command = {
        id: nextId(),
        type: 'node.rename',
        payload: { nodeId: operation.nodeId, name: operation.label },
        meta: {
          label: `Rename ${document.nodes[operation.nodeId]?.name ?? 'node'}`
            + ` · “${document.nodes[operation.nodeId]?.name ?? ''}” → “${operation.label}”`,
          source: 'scene-tree',
          targetIds: [operation.nodeId],
        },
      }
    }
    else if (operation.type === 'delete') {
      command = {
        id: nextId(),
        type: 'node.delete',
        payload: { nodeIds: operation.nodeIds },
        meta: {
          label: `Delete ${describeNodeTargets(document, operation.nodeIds)}`,
          source: 'scene-tree',
          targetIds: operation.nodeIds,
        },
      }
    }
    else if (operation.type === 'set-visibility') {
      command = {
        id: nextId(),
        type: 'node.set-visibility',
        payload: { nodeIds: operation.nodeIds, visible: operation.visible },
        meta: {
          label: `${operation.visible ? 'Show' : 'Hide'} `
            + describeNodeTargets(document, operation.nodeIds),
          source: 'scene-tree',
          targetIds: operation.nodeIds,
        },
      }
    }
    else if (operation.type === 'set-locked') {
      command = {
        id: nextId(),
        type: 'node.set-locked',
        payload: { nodeIds: operation.nodeIds, locked: operation.locked },
        meta: {
          label: `${operation.locked ? 'Lock' : 'Unlock'} `
            + describeNodeTargets(document, operation.nodeIds),
          source: 'scene-tree',
          targetIds: operation.nodeIds,
        },
      }
    }
    else if (operation.type === 'move') {
      const crossesParent = operation.nodeIds.some(
        (id) => getNodeParentId(document, id) !== operation.parentId,
      )
      command = crossesParent
        ? createReparentCommand(
            document,
            operation.nodeIds,
            operation.parentId,
            operation.index,
            nextId(),
          )
        : {
            id: nextId(),
            type: 'node.move',
            payload: {
              nodeIds: operation.nodeIds,
              parentId: operation.parentId,
              index: operation.index,
            },
            meta: {
              label: `Reorder ${describeNodeTargets(document, operation.nodeIds)}`
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
      if (duplicates.length === 1) command = duplicates[0]!.command
      else if (duplicates.length > 1) {
        command = {
          id: nextId(),
          type: 'transaction.batch',
          payload: {
            commands: duplicates.map((item) => item.command) as unknown as JsonValue,
          },
          meta: {
            label: `Duplicate ${describeNodeTargets(document, operation.sourceNodeIds)}`,
            source: 'scene-tree',
            targetIds: operation.sourceNodeIds,
          },
        }
      }
      nextSelection = duplicates.map((item) => item.rootId)
    }
    if (!command) return
    const result = runtime.dispatch(command)
    if (result.status === 'committed' && nextSelection) setSelectedIds(nextSelection)
  }, [document, nextId, runtime, setSelectedIds])

  const sceneTreeProps = useMemo<ComposeSceneTreeProps>(() => ({
    nodes: deriveSceneNodes(document, registry),
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
    framePresets,
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
    setSurfaceSize,
    interactionController,
    framePresets,
    nextId,
  ])

  const createFrame = useCallback(() => {
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
        .filter((id) => document.nodes[id] !== undefined)
        .map((id) => getNodeWorldBounds(document, id)),
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
  const fitFrame = useCallback(() => {
    const index = createStageSceneIndex(document)
    const frameId = selectedIds.length === 1
      && document.nodes[selectedIds[0]!]?.kind === 'frame'
      ? selectedIds[0]!
      : index.commonFrameForSelection(selectedIds)
    if (frameId) fitBounds([frameId])
  }, [document, fitBounds, selectedIds])
  const fitSelection = useCallback(() => fitBounds(selectedIds), [fitBounds, selectedIds])

  const selectedNode = selectedIds.length === 1
    ? document.nodes[selectedIds[0]!]
    : undefined
  const selectedFrameId = selectedIds.length === 1
    && selectedNode?.kind === 'frame'
    ? selectedNode.id
    : createStageSceneIndex(document).commonFrameForSelection(selectedIds)
  const smartSnapEnabled = document.canvas.smartSnap.nodes
    || document.canvas.smartSnap.guides
  const configureCanvas = (
    gridSnapEnabled: boolean,
    smartEnabled: boolean,
    label: string,
  ) => dispatch({
    id: nextId(),
    type: 'canvas.configure',
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
    meta: {
      label,
      source: 'stage-toolbar',
    },
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
        framePresets={framePresets}
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
    ) : selectedNode?.kind === 'component' ? (
      <ComposeRegistryInspector
        dispatch={dispatch}
        node={selectedNode}
        registry={registry}
      />
    ) : selectedNode && ContainerInspector ? (
      <ContainerInspector dispatch={dispatch} node={selectedNode} />
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
        createFrame={createFrame}
        dispatch={dispatch}
        document={document}
        fitFrame={fitFrame}
        fitSelection={fitSelection}
        nextId={nextId}
        selectedIds={selectedIds}
        selectedFrameId={selectedFrameId}
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
