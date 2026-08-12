import { CommandPanelWithActions } from './command-panel-actions'
import { createComposeEditorActionHandlers } from './action-catalog'
import type { ComposeEditorActionHandlerContext } from './action-catalog'
import { ComposeComponentPalette } from '@compose-ui/stage'
import {
  ComposeComponentLibraryPanel,
  ComposeComponentAssetIcon,
  createComposeComponentInstanceEntity,
  readComposeComponentInstance,
  type ComposeComponentLibraryItem,
  type ComposeComponentSnapshot,
  type ComposeComponentStore,
} from '@compose-ui/component-library'
import {
  createComponentExtractionPlan,
  createReplaceSelectionWithEntityCommand,
  createStageInteractionController,
  createStageSceneIndex,
  getEntityWorldBounds,
  unionRects,
  zoomViewportAt,
} from '@compose-ui/stage-engine'
import {
  BUILTIN_COMMAND_TYPES,
  composeInstancePathHostId,
  createTransactionRuntime,
  diffComposeComponentDocuments,
  decodeComposeInstancePath,
  encodeComposeInstancePath,
  getComposeComposition,
  getComposeHierarchy,
  getComposeLock,
  getComposeRenderer,
  getComposeVisibility,
  isComposeInstancePath,
  resolveComposeInstanceOverrides,
  type ComposeBaseComponentAsset,
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
  ComposeSceneTreeExternalDragEvent,
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

/**
 * 把组件实例解析后的内部实体投影为 Scene Tree 节点。
 *
 * @remarks
 * 投影只存在于编辑期表示层：宿主文档中实例仍是单个 Entity，内部节点用复合地址标识。
 *
 * 地址段数对应实例嵌套层数，而不是树深度：内部实体 ID 在组件文档内已唯一，因此同一实例内的
 * 任意深度都共用同一个前缀。按树深度逐层拼接会让层级较深的组件误撞段数上限。
 *
 * 结构编辑命令尚未接线，因此能力位一律关闭。
 * TODO(add-instance-structural-overrides 5.2): 结构操作接线后放开 canDelete/canMove/canRename。
 */
/**
 * 判断组件实例是否含可投影的内部子项。
 *
 * @remarks
 * 只读组件根的直接子项，不递归；用于在未展开时决定展开控件是否出现。
 */
function instanceHasInnerChildren(instance: ComposeEntity): boolean {
  const facts = readComposeComponentInstance(instance)
  if (!facts) return false
  const rootId = facts.snapshot.document.rootIds[0]
  if (!rootId) return false
  const root = facts.snapshot.document.entities[rootId]
  return root ? (getComposeHierarchy(root)?.childIds.length ?? 0) > 0 : false
}

function projectInstanceChildren(
  registry: ComposeEntityRegistry,
  instance: ComposeEntity,
  expandedIds: ReadonlySet<string>,
  addressPrefix: readonly string[],
): readonly ComposeSceneTreeNode[] | undefined {
  const facts = readComposeComponentInstance(instance)
  if (!facts) return undefined
  const resolved = resolveComposeInstanceOverrides({
    document: facts.snapshot.document,
    properties: facts.snapshot.properties,
    overrides: facts.overrides,
  })
  if (!resolved.ok) return undefined
  const innerDocument = resolved.document
  const rootId = innerDocument.rootIds[0]
  if (!rootId) return undefined
  // 组件根就是实例节点本身，因此投影从根的直接子项开始。
  const rootChildren = getComposeHierarchy(innerDocument.entities[rootId]!)?.childIds ?? []
  const project = (entityId: string): ComposeSceneTreeNode | null => {
    const inner = innerDocument.entities[entityId]
    if (!inner) return null
    const address = encodeComposeInstancePath([...addressPrefix, entityId])
    const innerHierarchy = getComposeHierarchy(inner)
    const composition = getComposeComposition(inner)
    const expanded = expandedIds.has(address)
    const children = innerHierarchy && expanded
      ? innerHierarchy.childIds
        .map((childId) => project(childId))
        .filter((node): node is ComposeSceneTreeNode => node !== null)
      : undefined
    return {
      id: address,
      label: inner.name,
      visible: getComposeVisibility(inner).visible,
      locked: getComposeLock(inner).locked,
      icon: composition.presetId ? registry.getPreset(composition.presetId)?.icon : undefined,
      canHaveChildren: innerHierarchy !== undefined,
      // 内部层级同样惰性物化，每一层都必须显式声明，否则第二层起就没有展开控件。
      hasChildren: (innerHierarchy?.childIds.length ?? 0) > 0,
      canRename: false,
      canDelete: false,
      canMove: false,
      canToggleVisibility: false,
      canToggleLocked: false,
      ...(children ? { children } : {}),
    }
  }
  return rootChildren
    .map((childId) => project(childId))
    .filter((node): node is ComposeSceneTreeNode => node !== null)
}

/**
 * 求出为了让复合地址可见而必须展开的祖先集合。
 *
 * @remarks
 * 从 Stage 下钻选中内部节点时，树上对应行可能还没被投影出来。这里解析实例内部文档，
 * 补齐宿主实例与内部祖先链，使选中行必然可见。
 */
function instanceSelectionAncestors(
  document: ComposeDocument,
  ids: readonly string[],
): readonly string[] {
  const ancestors: string[] = []
  for (const id of ids) {
    if (!isComposeInstancePath(id)) continue
    const decoded = decodeComposeInstancePath(id)
    if (!decoded.ok) continue
    const hostId = decoded.segments[0]!
    const innerId = decoded.segments[1]
    ancestors.push(hostId)
    const host = document.entities[hostId]
    if (!host || innerId === undefined) continue
    const facts = readComposeComponentInstance(host)
    if (!facts) continue
    const resolved = resolveComposeInstanceOverrides({
      document: facts.snapshot.document,
      properties: facts.snapshot.properties,
      overrides: facts.overrides,
    })
    if (!resolved.ok) continue
    // 组件根即实例节点本身，因此祖先链只收集根以下、目标以上的实体。
    const parentOf = new Map<string, string>()
    for (const entity of Object.values(resolved.document.entities)) {
      for (const childId of getComposeHierarchy(entity)?.childIds ?? []) {
        parentOf.set(childId, entity.id)
      }
    }
    const rootId = resolved.document.rootIds[0]
    for (
      let current = parentOf.get(innerId);
      current !== undefined && current !== rootId;
      current = parentOf.get(current)
    ) {
      ancestors.push(encodeComposeInstancePath([hostId, current]))
    }
  }
  return ancestors
}

/** 当前下钻选中的实例内部实体及其编辑入口。 @public */
export interface ComposeInstanceInnerSelection {
  /** 宿主文档中的实例 Entity ID。 */
  readonly instanceId: string
  /** 解析后的内部实体，供 Inspector 渲染。 */
  readonly entity: ComposeEntity
  /** 解析后的完整内部文档，Inspector 需要它读取父子关系。 */
  readonly document: ComposeDocument
  /**
   * 接收 Inspector 命令并写入实例覆盖。
   *
   * @remarks
   * 命令本是针对宿主文档的，这里先在内部文档的独立 Runtime 上执行，再用稳定 diff 重算
   * 整份结构操作列表，最后一次写回宿主实例。重算而不是追加，可以避免同一字段反复编辑
   * 累积成一长串等价操作。
   */
  readonly dispatch: (command: EditorCommand) => void
}

function sceneEntity(
  document: ComposeDocument,
  registry: ComposeEntityRegistry,
  entity: ComposeEntity,
  expandedIds: ReadonlySet<string>,
): ComposeSceneTreeNode {
  const hierarchy = getComposeHierarchy(entity)
  const locked = getComposeLock(entity).locked
  const composition = getComposeComposition(entity)
  const renderer = getComposeRenderer(entity)
  const resolvedSnapshot = renderer?.props.resolvedSnapshot
  const snapshotKind = renderer?.type === 'component-instance'
    && resolvedSnapshot
    && typeof resolvedSnapshot === 'object'
    && !Array.isArray(resolvedSnapshot)
    && (resolvedSnapshot as Readonly<Record<string, unknown>>).kind === 'variant'
    ? 'variant'
    : 'base'
  const componentInstance = composition.presetId === 'component-instance'
  return {
    id: entity.id,
    label: entity.name,
    visible: getComposeVisibility(entity).visible,
    locked,
    icon: componentInstance
      ? <ComposeComponentAssetIcon kind={snapshotKind} />
      : composition.presetId
      ? registry.getPreset(composition.presetId)?.icon
      : undefined,
    iconLabel: componentInstance
      ? snapshotKind === 'variant' ? '变体实例' : '组件实例'
      : composition.presetId === 'group'
        ? 'Group'
        : composition.presetId === 'container'
          ? 'Container'
          : undefined,
    // 实例没有 Hierarchy，但其内部层级可投影，因此仍可展开。
    canHaveChildren: hierarchy !== undefined || componentInstance,
    // 投影是惰性的：未展开时 children 尚未构建，必须显式声明才会出现展开控件。
    ...(componentInstance ? { hasChildren: instanceHasInnerChildren(entity) } : {}),
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
            .map((child) => sceneEntity(document, registry, child, expandedIds)),
        }
      : {}),
    ...(componentInstance && expandedIds.has(entity.id)
      ? (() => {
          const children = projectInstanceChildren(registry, entity, expandedIds, [entity.id])
          return children ? { children } : {}
        })()
      : {}),
  }
}

function deriveSceneEntities(
  document: ComposeDocument,
  registry: ComposeEntityRegistry,
  expandedIds: readonly string[],
): readonly ComposeSceneTreeNode[] {
  const expanded = new Set(expandedIds)
  return document.rootIds
    .map((id) => document.entities[id])
    .filter((entity): entity is ComposeEntity => entity !== undefined)
    .map((entity) => sceneEntity(document, registry, entity, expanded))
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

/**
 * 归一化选区。
 *
 * @remarks
 * 实例内部复合地址不对应宿主实体，只校验宿主实例是否仍存在且可见；内部实体是否存在由投影
 * 与命中阶段决定，避免在这里重复解析快照。
 */
function validSelection(document: ComposeDocument, ids: readonly string[]) {
  return unique(ids).filter((id) => {
    const entity = document.entities[composeInstancePathHostId(id)]
    if (!entity || !getComposeVisibility(entity).visible) return false
    return isComposeInstancePath(id) ? readComposeComponentInstance(entity) !== null : true
  })
}

/**
 * 归一化展开集合。
 *
 * @remarks
 * 除宿主容器外，组件实例与实例内部复合地址也可展开；复合地址只校验宿主实例是否仍存在，
 * 内部实体是否存在由投影阶段决定，避免在这里重复解析快照。
 */
function validExpanded(document: ComposeDocument, ids: readonly string[]) {
  return unique(ids).filter((id) => {
    if (isComposeInstancePath(id)) {
      const host = document.entities[composeInstancePathHostId(id)]
      return host ? readComposeComponentInstance(host) !== null : false
    }
    const entity = document.entities[id]
    if (!entity) return false
    return getComposeHierarchy(entity) !== undefined || readComposeComponentInstance(entity) !== null
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
  /** 可选项目组件 Store；省略时保持仅 Registry Preset 的基础组件面板。 */
  readonly componentStore?: ComposeComponentStore
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
  /** Controller 与组件工作区共享的项目组件 Store。 */
  readonly componentStore?: ComposeComponentStore
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
  /** 把当前规范化选区保存为组件资源，并在资源成功后原子替换为关联实例。 */
  readonly createComponentFromSelection: (
    input: ComposeCreateComponentFromSelectionInput,
  ) => Promise<ComposeCreateComponentFromSelectionResult>
  /** 最近一次来自 Stage、Scene Tree 或命令目录的“创建组件”命名请求。 */
  readonly createComponentRequest: ComposeCreateComponentRequest | null
  /** 场景树普通行拖向其他面板时的当前受控外部拖拽事件。 */
  readonly sceneExternalDragEvent: ComposeSceneTreeExternalDragEvent | null
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
  /** 当前下钻选中的实例内部实体；未下钻时为 null。 */
  readonly instanceInnerSelection: ComposeInstanceInnerSelection | null
  /** 默认 ComposeCommandPanel 内容。 */
  readonly commandPanel: ReactNode
  /** 默认 Stage 工具栏内容。 */
  readonly stageToolbar: ReactNode
}

/** 创建组件命名请求；sequence 使重复请求也可被宿主观察。 @public */
export interface ComposeCreateComponentRequest {
  readonly sequence: number
  readonly entityIds: readonly string[]
}

/** 从当前场景选区创建项目组件的输入。 @public */
export interface ComposeCreateComponentFromSelectionInput {
  /** 组件显示名；Store 会补齐 `.component.json` 后缀。 */
  readonly name: string
  /** 目标资源目录；null 表示 Provider 根目录。 @defaultValue null */
  readonly parentId?: string | null
  /** 覆盖当前选择的规范化来源；用于场景树跨面板拖拽结束时冻结起始选区。 */
  readonly entityIds?: readonly string[]
  readonly signal?: AbortSignal
}

/** 场景选区创建项目组件的失败安全结果。 @public */
export type ComposeCreateComponentFromSelectionResult =
  | {
      readonly status: 'committed'
      readonly component: ComposeComponentSnapshot
      readonly instanceId: string
    }
  | { readonly status: 'unavailable'; readonly reason: string }
  | { readonly status: 'failed'; readonly error: Error }
  | {
      readonly status: 'saved-not-instantiated'
      readonly component: ComposeComponentSnapshot
      readonly reason: string
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
  componentStore,
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
  const [sceneExternalDragEvent, setSceneExternalDragEvent] = useState<
    ComposeSceneTreeExternalDragEvent | null
  >(null)
  const [createComponentRequest, setCreateComponentRequest] = useState<
    ComposeCreateComponentRequest | null
  >(null)
  const createComponentRequestSequence = useRef(0)
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
    setSceneExternalDragEvent(null)
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

  // 不在这里按 document 过滤：刚提交的创建事务尚未进入闭包捕获的 document，
  // 过滤会把合法的新实体选区误杀。归一化只发生在文档变化时。
  const setSelectedIds = useCallback((ids: readonly string[]) => {
    const next = unique(ids)
    setSelectedIdsState(next)
    const ancestors = instanceSelectionAncestors(document, next)
    if (ancestors.length > 0) {
      setExpandedIdsState((current) => unique([...current, ...ancestors]))
    }
    setInspectionTarget(next.length > 0 ? 'entities' : null)
    if (next.length !== 1) {
      setPaintEditing(null)
      setPaintSampling(null)
    }
  }, [document])
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

  const createComponentFromSelection = useCallback(async (
    input: ComposeCreateComponentFromSelectionInput,
  ): Promise<ComposeCreateComponentFromSelectionResult> => {
    if (!componentStore) {
      return { status: 'unavailable', reason: '未配置 Component Store' }
    }
    const started = runtime.getState()
    if (layoutState.status !== 'ready' || layoutState.document !== started.document) {
      return { status: 'unavailable', reason: '布局尚未就绪' }
    }
    const componentId = nextId()
    const extraction = createComponentExtractionPlan({
      document: started.document,
      layoutSnapshot: layoutState.snapshot,
      selectedIds: input.entityIds ?? selectedIds,
      groupId: nextId(),
      name: input.name.trim(),
    })
    if (extraction.status !== 'ready') {
      return { status: 'unavailable', reason: extraction.reason }
    }
    const asset: ComposeBaseComponentAsset = {
      schemaVersion: 1,
      kind: 'base',
      componentId,
      name: input.name.trim(),
      document: extraction.componentDocument,
      properties: [],
    }
    let component: ComposeComponentSnapshot
    try {
      component = await componentStore.createComponent({
        parentId: input.parentId ?? null,
        fileName: input.name,
        asset,
        signal: input.signal,
      })
    }
    catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
    // 资源写入是不可回滚的外部副作用；等待期间场景变化时保留资源并停止实例化。
    if (runtime.getState().revision !== started.revision) {
      return {
        status: 'saved-not-instantiated',
        component,
        reason: '资源已保存，但文档在创建期间发生变化',
      }
    }
    const instanceId = nextId()
    const created = createComposeComponentInstanceEntity({
      registry,
      id: instanceId,
      asset: component.asset,
      reference: componentStore.createReference(component.assetKey),
      revision: component.revision,
    })
    if (!created.ok) {
      return {
        status: 'saved-not-instantiated',
        component,
        reason: created.reason,
      }
    }
    const dispatched = runtime.dispatch(createReplaceSelectionWithEntityCommand({
      document: started.document,
      plan: extraction,
      entity: created.entity,
      commandId: nextId(),
      deleteCommandId: nextId(),
      createCommandId: nextId(),
    }))
    if (dispatched.status !== 'committed') {
      return {
        status: 'saved-not-instantiated',
        component,
        reason: dispatched.status === 'rejected'
          ? dispatched.issues.map(({ message }) => message).join('；')
          : dispatched.reason ?? '场景事务未提交',
      }
    }
    setSelectedIds([instanceId])
    return { status: 'committed', component, instanceId }
  }, [componentStore, layoutState, nextId, registry, runtime, selectedIds, setSelectedIds])

  const libraryDragItem = useCallback((item: ComposeComponentLibraryItem) => (
    item.kind === 'preset'
      ? { kind: 'preset' as const, presetId: item.presetId }
      : {
          kind: 'assets' as const,
          items: [{
            providerId: item.descriptor.reference.providerId,
            assetKey: item.descriptor.reference.assetKey,
            scope: item.descriptor.reference.scope,
            name: item.descriptor.displayName,
            mediaType: 'application/vnd.compose-ui.component+json',
          }],
        }
  ), [])
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

  const requestCreateComponent = useCallback((entityIds: readonly string[] = selectedIds) => {
    const normalized = validSelection(document, entityIds)
    if (!componentStore || normalized.length === 0) return
    setCreateComponentRequest({
      sequence: ++createComponentRequestSequence.current,
      entityIds: normalized,
    })
  }, [componentStore, document, selectedIds])

  const sceneTreeProps = useMemo<ComposeSceneTreeProps>(() => ({
    nodes: deriveSceneEntities(document, registry, expandedIds),
    selectedIds,
    expandedIds,
    onSelectionChange: setSelectedIds,
    onExpandedChange: setExpandedIds,
    onOperation: onSceneOperation,
    onExternalDrag: setSceneExternalDragEvent,
    onCreateComponentIntent: componentStore ? requestCreateComponent : undefined,
  }), [
    document,
    registry,
    selectedIds,
    expandedIds,
    setSelectedIds,
    setExpandedIds,
    onSceneOperation,
    componentStore,
    requestCreateComponent,
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
    onCreateComponentIntent: componentStore ? requestCreateComponent : undefined,
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
    componentStore,
    requestCreateComponent,
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
    createComponent: componentStore ? () => { requestCreateComponent() } : undefined,
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
    componentStore,
    requestCreateComponent,
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
  /**
   * 解析当前下钻选中的实例内部实体。
   *
   * @remarks
   * 内部实体不在宿主文档里，必须按 Base → Variant 链 → 实例覆盖解析后才能取到。
   */
  const instanceInnerSelection = useMemo<ComposeInstanceInnerSelection | null>(() => {
    if (selectedIds.length !== 1) return null
    const address = selectedIds[0]!
    if (!isComposeInstancePath(address)) return null
    const decoded = decodeComposeInstancePath(address)
    if (!decoded.ok) return null
    const [instanceId, innerId] = decoded.segments
    if (!instanceId || !innerId) return null
    const host = document.entities[instanceId]
    if (!host) return null
    const facts = readComposeComponentInstance(host)
    if (!facts) return null
    const resolved = resolveComposeInstanceOverrides({
      document: facts.snapshot.document,
      properties: facts.snapshot.properties,
      overrides: facts.overrides,
    })
    if (!resolved.ok) return null
    const entity = resolved.document.entities[innerId]
    if (!entity) return null
    return {
      instanceId,
      entity,
      document: resolved.document,
      dispatch: (command: EditorCommand) => {
        // 在内部文档的一次性 Runtime 上执行，得到编辑后的完整内部文档。
        const innerRuntime = createTransactionRuntime({ document: resolved.document })
        const applied = innerRuntime.dispatch(command)
        if (applied.status !== 'committed') return
        // 与「未施加实例覆盖」的快照做稳定 diff，重算整份结构操作。
        const diff = diffComposeComponentDocuments({
          parent: facts.snapshot.document,
          current: innerRuntime.document,
        })
        if (!diff.ok) return
        const renderer = host.components.Renderer
        if (!renderer) return
        runtime.dispatch({
          // 不用 controller 的 idFactory：它读 ref，会被 React Compiler 判为渲染期访问。
          id: defaultIdFactory(),
          type: BUILTIN_COMMAND_TYPES.setRendererProps,
          payload: {
            entityId: instanceId,
            props: {
              ...(renderer.props as Record<string, unknown>),
              instanceOverrides: {
                properties: facts.overrides.properties,
                operations: diff.operations,
              },
            },
          },
          meta: {
            label: `Edit ${entity.name} inside ${host.name}`,
            source: 'inspector',
            targetIds: [instanceId],
          },
        } as unknown as EditorCommand)
      },
    }
  }, [document, runtime, selectedIds])

  const inspectorPanel = resolvedInspectionTarget === 'output' ? (
    // 输出配置会在色盘拖动的每个采样点更新。不能以输出值作为 key，
    // 否则会卸载活跃的 ColorPicker 并中断原生 pointer 手势。
    <CanvasInspector
      dispatch={dispatch}
      document={document}
      idFactory={nextId}
    />
  ) : instanceInnerSelection ? (
    <EntityInspector
      dispatch={instanceInnerSelection.dispatch}
      document={instanceInnerSelection.document}
      entity={instanceInnerSelection.entity}
      idFactory={nextId}
      // 按复合地址重挂载：切换内部目标时局部会话状态不得残留。
      key={selectedIds[0]}
      registry={registry}
      renameDisabled
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
    componentStore,
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
    createComponentFromSelection,
    createComponentRequest,
    sceneExternalDragEvent,
    sceneTreeProps,
    stageProps,
    componentLibraryPanel: componentStore ? (
      <ComposeComponentLibraryPanel
        registry={registry}
        store={componentStore}
        onCreateIntent={(item) => {
          interactionController.send({ type: 'external.add', item: libraryDragItem(item) })
        }}
        onItemDragStart={({ item, clientPoint }) => {
          interactionController.send({
            type: 'external.begin',
            item: libraryDragItem(item),
            clientPoint,
          })
        }}
        onItemDragMove={({ clientPoint }) => {
          interactionController.send({ type: 'external.move', clientPoint })
        }}
        onItemDragEnd={({ clientPoint }) => {
          interactionController.send({ type: 'external.end', clientPoint })
        }}
        onItemDragCancel={() => {
          interactionController.send({ type: 'external.cancel' })
        }}
      />
    ) : (
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
    instanceInnerSelection,
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
