import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import {
  useComposeContextMenu,
} from '@compose-ui/components'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  ComposeAssetReference,
  ComposeAssetResolver,
  ComposeResolvedAsset,
} from '@compose-ui/assets'
import {
  createComposeRendererMeasurementAdapter,
} from '@compose-ui/component-registry'
import type {
  ComposeRendererMeasurementAdapter,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  collectComposeSwitcherHiddenIds,
  isComposeInstancePath,
  encodeComposeInstancePath,
  getComposeHierarchy,
  getComposeLayout,
  getComposeLock,
  getComposeRenderer,
  getComposeVisibility,
  resolveComposeAppearance,
  resolveComposeGeometryConstraints,
  resolveComposeSwitcherPreview,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import {
  createRulerTicks,
  createStageInteractionController,
  createStageSceneIndex,
  listFrameWorldGuides,
  resolveTargetFrameId,
  resolveStageDropIndicator,
  expandScrollRange,
  scrollAxisToViewport,
  viewportToScrollAxes,
  applyMatrix,
  getEntityWorldBounds,
  getEntityWorldMatrix,
  invertMatrix,
  screenToWorld,
  unionRects,
  worldToScreen,
  zoomViewportAt,
  toComposeTransform,
  type ResizeHandle,
  type StagePoint,
  type StageRect,
  type StageDrawnEntity,
  type StageInteractionEffect,
  type StageInteractionHit,
  type StageInteractionController,
} from '@compose-ui/stage-engine'
import type {
  ComposeStageKeybinding,
  ComposeStageShortcutAction,
  ComposeStagePolicy,
  ComposeStageProps,
} from '../types'
import { nextInstanceDrillDownTarget, resolveInstanceDrillDownPath } from './instance-drilldown'
import { instanceSelectionScreenBounds } from './instance-selection-bounds'
import { StageScrollbar } from '../scrollbar'
import { StageOverlay } from '../stage-overlay'
import {
  assetSeedCenters,
  mapWithConcurrency,
  presetForDrawingTool,
} from './stage-asset-drop'
import {
  frozenSurfaceRect,
  modifiers,
  pressedButtons,
  resolveClientPoint,
  screenPoint,
  screenPointFromRect,
  type FrozenSurfaceRect,
} from './stage-pointer-geometry'
import {
  bootstrapSelectionBounds,
  directionAxis,
  lineSegmentForEntity,
  lineSegmentTransform,
  transformDocument,
  transformLayoutSnapshot,
  type StageTransformMap,
} from './stage-preview-document'
import {
  DEFAULT_STAGE_SHORTCUTS,
  STAGE_SHORTCUT_ACTIONS,
} from './stage-shortcuts'
import { StageContextMenu } from './stage-context-menu'
import { useStageTextEditing } from './use-stage-text-editing'
import { useStageClipboard } from './use-stage-clipboard'
import { useStageKeyboardCommands } from './use-stage-keyboard'
import { StageRulers, type StageRulersHandle } from '../stage-ruler'
import { StageSceneLayer } from '../stage-scene-layer'
import { buildResizePreviewSolveDocument } from './resize-preview'
import {
  describeEntityCreation,
} from '@compose-ui/stage-engine'
import { getStageMessages } from '../stage-i18n'
import { createVisualGridStyle } from '../grid-rendering'
import { ComposeContainerLabelLayer } from '../container-label-layer'
import {
  boundsCenter,
  entityFromDrawingSeed,
  entityFromSeed,
  expandClickDrawingBounds,
  seedWorldBounds,
  type ShapeDirection,
} from './drawing-entity'
import { boundsInParentSpace, resolveRootLanding } from './root-landing'

type Modifiers = { shift: boolean; alt: boolean; command: boolean }
type PointerSessionStatus = 'active' | 'finishing' | 'ended'

const WORLD_ORIGIN_ICON_HALF_SIZE = 8
/** 一次进行中的指针会话；surface 矩形在按下当刻冻结。 */
interface ActivePointerSession {
  readonly pointerId: number
  readonly generation: number
  readonly surfaceRect: FrozenSurfaceRect
  lastPoint: StagePoint
  lastModifiers: Modifiers
  buttons: number
  status: PointerSessionStatus
  captureOwned: boolean
}

interface PendingPointerSample {
  readonly pointerId: number
  readonly generation: number
  readonly point: StagePoint
  readonly modifiers: Modifiers
}

function defaultId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `stage-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** 宿主省略 policy 时的解构底座；共用常量避免每帧分配一个空对象。 */
const EMPTY_STAGE_POLICY: ComposeStagePolicy = Object.freeze({})


function useFinalControllerDisposal(controller: StageInteractionController) {
  const effectGeneration = useRef(0)
  useEffect(() => {
    effectGeneration.current += 1
    const mountedGeneration = effectGeneration.current
    return () => {
      // StrictMode 的 effect 重放不是最终卸载；后续 setup 会提升 generation 并取消本次释放。
      queueMicrotask(() => {
        if (effectGeneration.current === mountedGeneration) controller.dispose()
      })
    }
  }, [controller])
}

export function ComposeStage(props: ComposeStageProps) {
  const measurementAdapter = useComposeStageMeasurement(props)
  if (!props.layoutSnapshot) {
    return (
      <div
        aria-busy={props.layoutError ? undefined : true}
        className={props.className}
        data-compose-ui="stage"
        role={props.layoutError ? 'alert' : 'status'}
      >
        {props.layoutError ?? '正在加载自动布局引擎…'}
      </div>
    )
  }
  const {
    layoutError: _layoutError,
    layoutSnapshot,
    ...readyProps
  } = props
  void _layoutError
  return (
    <ComposeStageReady
      {...readyProps}
      layoutSnapshot={layoutSnapshot}
      measurementAdapter={measurementAdapter}
    />
  )
}

type ComposeStageReadyProps = Omit<
  ComposeStageProps,
  'layoutError' | 'layoutSnapshot'
> & {
  readonly layoutSnapshot: ComposeLayoutSnapshot
  /** 原地编辑期间把编辑中的文本送进测量链路，使 Auto width 实时改宽。 */
  readonly measurementAdapter: ComposeRendererMeasurementAdapter
}

function useComposeStageMeasurement({
  document,
  scriptScope,
  services,
}: ComposeStageProps) {
  // 按字段消费端口而不是整个 services 对象：adapter 只应在它实际使用的那几个端口变化时
  // 重建。以对象引用作依赖会让宿主每次重新构造 services 都重建 adapter 并丢弃测量缓存。
  const { assetResolver, layoutRuntime, pageLoader, registry } = services
  const adapter = useMemo(() => createComposeRendererMeasurementAdapter({
    registry,
    assetResolver,
    pageDocumentPort: pageLoader,
    scriptScope,
  }), [assetResolver, pageLoader, registry, scriptScope])
  const disposalGenerations = useRef(new WeakMap<ComposeRendererMeasurementAdapter, number>())

  useLayoutEffect(() => adapter.updateDocument(document), [adapter, document])
  useLayoutEffect(() => {
    if (!layoutRuntime) return
    layoutRuntime.setMeasurementPort(adapter)
    return () => layoutRuntime.setMeasurementPort(undefined)
  }, [adapter, layoutRuntime])
  useEffect(() => {
    const generations = disposalGenerations.current
    const generation = (generations.get(adapter) ?? 0) + 1
    generations.set(adapter, generation)
    return () => queueMicrotask(() => {
      if (generations.get(adapter) !== generation) return
      adapter.dispose()
      generations.delete(adapter)
    })
  }, [adapter])
  return adapter
}

/**
 * 双击判定窗口与容差。
 *
 * Pointer Events 规范规定 `pointerdown` 的 `detail` 恒为 0，拿不到浏览器的连击计数，
 * 只能自己归一化。500ms / 5px 取各平台双击判定的常见值。
 */
const DOUBLE_CLICK_INTERVAL_MS = 500
const DOUBLE_CLICK_SLOP_PX = 5

/** 判断 Entity 是否为关联组件实例。 */
function isComponentInstanceEntity(entity: ComposeEntity) {
  return getComposeRenderer(entity)?.type === 'component-instance'
}

function ComposeStageReady({
  document,
  layoutSnapshot,
  layoutPreviewSnapshot,
  measurementAdapter,
  scriptScope,
  services,
  policy,
  viewport,
  onViewportChange,
  tool,
  onToolChange,
  onShortcutAction,
  shortcuts,
  selectedIds,
  onSelectedIdsChange,
  onEntityRename,
  onSceneActivate,
  onScenePreview,
  onCreateComponentIntent,
  activeFrameId,
  paintEditing = null,
  paintSampling = null,
  onPaintSamplingComplete,
  editablePath = null,
  editablePathActiveVertexId = null,
  onEditablePathChange,
  onEditablePathVertexToggle,
  onSurfaceSizeChange,
  interactionController,
  idFactory = defaultId,
  id,
  className,
  style,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onWheel,
  ...props
}: ComposeStageReadyProps) {
  const {
    assetResolver,
    clipboard: clipboardProp,
    dispatch,
    layoutRuntime,
    onClipboardChange,
    pageLoader,
    registry,
    scriptModuleLoader,
  } = services
  // policy 的每一项都有自身缺省值，宿主整体省略与逐项省略必须等价。
  const {
    gridVisible = true,
    lockGestureParent,
    marqueeMode,
  } = policy ?? EMPTY_STAGE_POLICY
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const resolvedLocale = i18n?.locale ?? 'zh-CN'
  const messages = getStageMessages(resolvedLocale, i18n?.formatMessage)
  const generatedSurfaceId = useId()
  const surfaceId = id ? `${id}-surface` : generatedSurfaceId
  const rootRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const rulersRef = useRef<StageRulersHandle>(null)
  const activePointerSessionRef = useRef<ActivePointerSession | null>(null)
  const pointerGenerationRef = useRef(0)
  const pendingPointerStartRef = useRef<{
    readonly pointerId: number
    readonly buttons: number
    readonly surfaceRect: FrozenSurfaceRect
    readonly point: StagePoint
    readonly modifiers: Modifiers
  } | null>(null)
  const pendingRef = useRef<PendingPointerSample | null>(null)
  const frameRequestRef = useRef<number | null>(null)
  const pointerRouteCleanupRef = useRef<(() => void) | null>(null)
  const lastPointerDownRef = useRef<{
    readonly time: number
    readonly x: number
    readonly y: number
    readonly count: number
  } | null>(null)
  /** 实例内部选中框的 surface 相对矩形；内部几何只在 DOM 上，必须测量而非计算。 */
  const [instanceSelectionBounds, setInstanceSelectionBounds] = useState<StageRect | null>(null)
  /** 当前已下钻到的实例内部层级；见 beginEntity 中的说明。 */
  const drillContextRef = useRef<{
    readonly instanceId: string
    readonly innerId: string
  } | null>(null)
  const expectedLostCaptureRef = useRef(new Map<number, number[]>())
  const [privateController] = useState(createStageInteractionController)
  const controller = interactionController ?? privateController
  const interaction = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  const segmentTransform = useMemo(
    () => interaction.segmentPreview
      ? lineSegmentTransform(document, layoutSnapshot, interaction.segmentPreview)
      : null,
    [document, interaction.segmentPreview, layoutSnapshot],
  )
  const previewTransforms = useMemo<StageTransformMap>(() => ({
    ...interaction.previewTransforms,
    ...(segmentTransform
      ? { [interaction.segmentPreview!.entityId]: segmentTransform.transform }
      : {}),
  }), [interaction.previewTransforms, interaction.segmentPreview, segmentTransform])
  const previewDirections = useMemo<Readonly<Record<string, ShapeDirection>>>(() => (
    segmentTransform && interaction.segmentPreview
      ? { [interaction.segmentPreview.entityId]: segmentTransform.direction }
      : {}
  ), [interaction.segmentPreview, segmentTransform])
  const marquee = interaction.marquee
  const snapGuides = interaction.snapGuides
  const guidePreview = interaction.guidePreview
  const [surfaceSize, setSurfaceSize] = useState({ width: 900, height: 600 })
  const {
    authoredText: textEditingValue,
    changeTextEditing,
    contentReflowsWithWidth,
    enterTextEditing,
    exitTextEditing,
    isEditing: isTextEditingActive,
    isTextEditable,
    session: textEditing,
  } = useStageTextEditing({
    dispatch,
    document,
    idFactory,
    measurementAdapter,
    registry,
    restoreFocus: () => surfaceRef.current?.focus(),
  })
  // 宿主回灌给 Controller 的「本次绘制创建了谁」；Controller 按 entityId 去重。
  const [lastDrawn, setLastDrawn] = useState<StageDrawnEntity | null>(null)
  const [assetDropStatus, setAssetDropStatus] = useState('')
  const contextMenu = useComposeContextMenu<string | null>()
  const pendingAssetDropsRef = useRef(new Set<AbortController>())
  const resolvedShortcuts = useMemo(
    () => Object.fromEntries(STAGE_SHORTCUT_ACTIONS.map((action) => [
      action,
      shortcuts?.[action] ?? DEFAULT_STAGE_SHORTCUTS[action],
    ])) as unknown as Readonly<
      Record<ComposeStageShortcutAction, readonly ComposeStageKeybinding[]>
    >,
    [shortcuts],
  )
  const previewDocument = useMemo(
    () => transformDocument(document, previewTransforms, previewDirections),
    [document, previewDirections, previewTransforms],
  )
  const previewLayoutSnapshot = useMemo(
    () => transformLayoutSnapshot(layoutSnapshot, previewTransforms),
    [layoutSnapshot, previewTransforms],
  )
  // resize 手势的实时布局：把预览文档交给 Layout Runtime 求解，兄弟随拖动让位。
  // 只有 Flow 目标需要求解（Absolute 不参与排布，previewTransforms 覆盖已足够）。
  const resizeSolveDocument = useMemo(
    () => (interaction.phase === 'resize' && layoutRuntime?.previewDocument
      ? buildResizePreviewSolveDocument(previewDocument, Object.keys(previewTransforms))
      : null),
    [interaction.phase, layoutRuntime, previewDocument, previewTransforms],
  )
  useEffect(() => {
    const runtime = layoutRuntime
    if (!runtime?.previewDocument || !runtime.clearPreview) return
    if (!resizeSolveDocument) {
      runtime.clearPreview()
      return
    }
    // rAF 合并：120Hz pointermove 下每帧最多一次求解；卸载或换帧取消未执行的请求。
    const frame = requestAnimationFrame(() => runtime.previewDocument!(resizeSolveDocument))
    return () => cancelAnimationFrame(frame)
  }, [layoutRuntime, resizeSolveDocument])
  // 卸载兜底：手势中途卸载 Stage 时不把预览状态留在宿主 Runtime 里。
  useEffect(() => () => layoutRuntime?.clearPreview?.(), [layoutRuntime])
  // 场景渲染优先用实时求解结果；求解只在 resize 期间生效，其余手势维持既有覆盖预览。
  // 预览 Snapshot 不进入交互 Controller 的 context（见 updateContext），提交几何始终以
  // 冻结的提交态 Snapshot 为准。
  const sceneLayoutSnapshot = resizeSolveDocument && layoutPreviewSnapshot
    ? layoutPreviewSnapshot
    : previewLayoutSnapshot
  const normalizedSelection = useMemo(
    () => selectedIds.filter((id) => Boolean(document.entities[id])),
    [document, selectedIds],
  )
  // 内部实体几何由嵌套 Runtime 决定，宿主既无 LayoutItem 也无场景索引条目，只能在提交后测量。
  // viewport 与 document 变化都会改变屏幕矩形，因此都要重新测量。
  const instanceSelectionAddress = selectedIds.length === 1 && isComposeInstancePath(selectedIds[0]!)
    ? selectedIds[0]!
    : null
  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!surface || instanceSelectionAddress === null) {
      setInstanceSelectionBounds(null)
      return
    }
    setInstanceSelectionBounds(instanceSelectionScreenBounds(surface, instanceSelectionAddress))
  }, [instanceSelectionAddress, viewport, document, layoutSnapshot])

  // 编辑期把「选中即预览」与 activeIndex 合成一份隐藏集合：渲染、SceneIndex 与手势 Controller
  // 必须共用同一个引用，否则会出现「看得见却点不到」。
  // 宿主每次渲染都可能传入新的 selectedIds 数组，因此第一层 memo 以内容 key 作为依赖，
  // 平移帧不会重新遍历文档。
  const selectionKey = normalizedSelection.join('\u0000')
  const hiddenIdsKey = useMemo(
    () => [...collectComposeSwitcherHiddenIds(
      document,
      resolveComposeSwitcherPreview(
        document,
        selectionKey === '' ? [] : selectionKey.split('\u0000'),
      ),
    )].join('\u0000'),
    [document, selectionKey],
  )
  // 第二层 memo 让集合引用只在内容真正变化时更新：场景子树与 SceneIndex 缓存都以它为键，
  // 每次文档编辑都换新引用会重建整棵场景，正在测量的实例内部选中框会因此丢失。
  const hiddenEntityIds = useMemo(
    () => new Set(hiddenIdsKey === '' ? [] : hiddenIdsKey.split('\u0000')),
    [hiddenIdsKey],
  )

  const lineSelection = useMemo(
    () => normalizedSelection.length === 1
      ? lineSegmentForEntity(previewDocument, previewLayoutSnapshot, normalizedSelection[0]!)
      : null,
    [normalizedSelection, previewDocument, previewLayoutSnapshot],
  )
  // 落点几何用未经 preview 变形的原始文档：拖动中的目标已被移开，兄弟与容器的真实位置
  // 才是插入线该贴的地方。
  const dropTarget = interaction.dropTarget
  const dropIndicator = useMemo(() => dropTarget
    ? resolveStageDropIndicator({
        index: createStageSceneIndex(document, layoutSnapshot, hiddenEntityIds),
        target: dropTarget,
        draggedIds: normalizedSelection,
      })
    : null, [document, dropTarget, hiddenEntityIds, layoutSnapshot, normalizedSelection])
  // 首帧可能先于 effect 中的 context 注入；之后（含 gesture preview）以 engine snapshot 为准。
  const bounds = interaction.selectionBounds
    ?? bootstrapSelectionBounds(previewDocument, previewLayoutSnapshot, normalizedSelection)
  const editableSelection = normalizedSelection.length > 0
    && normalizedSelection.every((id) => {
      const entity = document.entities[id]
      return entity
        && getComposeVisibility(entity).visible
        && !getComposeLock(entity).locked
    })
  const selectionConstraints = normalizedSelection.flatMap((id) => {
    const entity = document.entities[id]
    if (!entity) return []
    const constraints = resolveComposeGeometryConstraints(entity)
    // 已落盘的旧实例可能仍是 resize:none；选区层强制 free，保证页面组合始终可四角缩放。
    if (getComposeRenderer(entity)?.type === 'component-instance') {
      return [{ ...constraints, resize: 'free' as const }]
    }
    return [constraints]
  })
  const allResizeHandles = [
    'n',
    'ne',
    'e',
    'se',
    's',
    'sw',
    'w',
    'nw',
  ] as const satisfies readonly ResizeHandle[]
  const resizeHandles = allResizeHandles.filter((handle) =>
    selectionConstraints.every((constraints) => {
      if (constraints.resize === 'none') return false
      if (constraints.resize === 'horizontal') return handle === 'e' || handle === 'w'
      if (constraints.resize === 'vertical') return handle === 'n' || handle === 's'
      if (constraints.resize === 'preserve-aspect') {
        return handle === 'ne' || handle === 'se' || handle === 'sw' || handle === 'nw'
      }
      return true
    }))
  // free / preserve-aspect：仅四角可见小方块；边方向缩放靠透明 edge hit，不画中点方块。
  // horizontal / vertical：仍显示对应边控点（没有角可用）。
  const visibleResizeHandles = resizeHandles.filter((handle) => {
    if (handle === 'n' || handle === 'e' || handle === 's' || handle === 'w') {
      return selectionConstraints.every(
        (constraints) => constraints.resize === 'horizontal'
          || constraints.resize === 'vertical',
      )
    }
    return true
  })
  const selectionRotatable = selectionConstraints.length > 0
    && selectionConstraints.every(({ rotatable }) => rotatable)
  const contextNodeId = contextMenu.payload
  const contextEditableIds = normalizedSelection.filter((id) => {
    const entity = document.entities[id]
    return entity && !getComposeLock(entity).locked
  })

  const latestRef = useRef({
    document,
    layoutSnapshot,
    registry,
    activeFrameId,
    assetResolver,
    dispatch,
    viewport,
    onViewportChange,
    onSelectedIdsChange,
    onPaintSamplingComplete,
    onEditablePathChange,
    onEditablePathVertexToggle,
    idFactory,
  })
  useLayoutEffect(() => {
    latestRef.current = {
      document,
      layoutSnapshot,
      registry,
      activeFrameId,
      assetResolver,
      dispatch,
      viewport,
      onViewportChange,
      onSelectedIdsChange,
      onPaintSamplingComplete,
      onEditablePathChange,
      onEditablePathVertexToggle,
      idFactory,
    }
  })

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const handleWheel = (event: WheelEvent) => {
      const surface = surfaceRef.current
      if (
        !surface
        || (!surface.contains(event.target as Node) && event.target !== root)
      ) return
      const current = latestRef.current
      const point = screenPoint(event, surface)
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.002)
        current.onViewportChange(zoomViewportAt(
          current.viewport,
          point,
          current.viewport.zoom * factor,
        ))
      }
      else {
        current.onViewportChange({
          ...current.viewport,
          x: current.viewport.x - event.deltaX,
          y: current.viewport.y - event.deltaY,
        })
      }
      // React 将 wheel 事件作为 passive listener 委托；在其 SyntheticEvent 中调用
      // preventDefault 会产生浏览器警告且无法阻止页面滚动。Stage 需要独占画布平移，
      // 因此在根元素上安装显式的非 passive 原生监听器。
      event.preventDefault()
    }
    root.addEventListener('wheel', handleWheel, { passive: false })
    return () => root.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    const pending = pendingAssetDropsRef.current
    return () => {
      pending.forEach((request) => request.abort())
      pending.clear()
    }
  }, [assetResolver])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const measure = () => {
      const rect = surface.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const next = { width: rect.width, height: rect.height }
      setSurfaceSize((current) => current.width === next.width && current.height === next.height
        ? current
        : next)
      onSurfaceSizeChange?.(next)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(surface)
    return () => observer.disconnect()
  }, [onSurfaceSizeChange])

  const clearPending = useCallback((generation?: number) => {
    if (
      generation === undefined
      || pendingRef.current?.generation === generation
    ) {
      pendingRef.current = null
      if (frameRequestRef.current !== null) {
        cancelAnimationFrame(frameRequestRef.current)
        frameRequestRef.current = null
      }
    }
  }, [])

  const stopPointerRoute = useCallback(() => {
    pointerRouteCleanupRef.current?.()
    pointerRouteCleanupRef.current = null
  }, [])

  const endPointerSession = useCallback((session: ActivePointerSession) => {
    if (activePointerSessionRef.current?.generation !== session.generation) return
    session.status = 'ended'
    clearPending(session.generation)
    stopPointerRoute()
    activePointerSessionRef.current = null
  }, [clearPending, stopPointerRoute])

  const releasePointer = useCallback((pointerId: number) => {
    const session = activePointerSessionRef.current
    if (!session || session.pointerId !== pointerId) return
    session.status = 'ended'
    clearPending(session.generation)
    stopPointerRoute()

    const root = rootRef.current
    const shouldRelease = session.captureOwned
    session.captureOwned = false
    if (shouldRelease) {
      const expected = expectedLostCaptureRef.current.get(pointerId) ?? []
      expected.push(session.generation)
      expectedLostCaptureRef.current.set(pointerId, expected)
    }
    try {
      if (shouldRelease && typeof root?.releasePointerCapture === 'function') {
        root.releasePointerCapture(pointerId)
      }
    }
    catch {
      // pointerup/pointercancel 可能已让浏览器隐式释放 capture。
    }
    if (activePointerSessionRef.current?.generation === session.generation) {
      activePointerSessionRef.current = null
    }
  }, [clearPending, stopPointerRoute])

  const sendPointerMove = useCallback((sample: PendingPointerSample) => {
    const session = activePointerSessionRef.current
    if (
      !session
      || session.status !== 'active'
      || session.pointerId !== sample.pointerId
      || session.generation !== sample.generation
    ) return
    controller.send({
      type: 'pointer.move',
      pointerId: sample.pointerId,
      point: sample.point,
      modifiers: sample.modifiers,
    })
  }, [controller])

  const scheduleUpdate = useCallback((
    session: ActivePointerSession,
    event: Pick<PointerEvent, 'clientX' | 'clientY' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>,
  ) => {
    const sample: PendingPointerSample = {
      pointerId: session.pointerId,
      generation: session.generation,
      point: screenPointFromRect(event, session.surfaceRect),
      modifiers: modifiers(event),
    }
    session.lastPoint = sample.point
    session.lastModifiers = sample.modifiers
    pendingRef.current = sample
    if (frameRequestRef.current !== null) return
    const generation = session.generation
    let ranSynchronously = false
    const request = requestAnimationFrame(() => {
      ranSynchronously = true
      frameRequestRef.current = null
      const pending = pendingRef.current
      if (!pending || pending.generation !== generation) return
      pendingRef.current = null
      sendPointerMove(pending)
    })
    frameRequestRef.current = ranSynchronously ? null : request
  }, [sendPointerMove])

  const refreshDrawingModifier = useCallback((
    session: ActivePointerSession,
    event: KeyboardEvent,
  ) => {
    if (
      event.key !== 'Shift'
      || session.status !== 'active'
      || controller.getSnapshot().phase !== 'draw'
    ) return
    const sample: PendingPointerSample = {
      pointerId: session.pointerId,
      generation: session.generation,
      point: session.lastPoint,
      modifiers: {
        shift: event.type === 'keydown',
        alt: event.altKey,
        command: event.ctrlKey || event.metaKey,
      },
    }
    // 如果当前帧已有 pointermove，必须同步替换其中的修饰键，避免 rAF 将旧状态写回。
    if (pendingRef.current?.generation === session.generation) pendingRef.current = sample
    session.lastModifiers = sample.modifiers
    controller.send({
      type: 'pointer.move',
      pointerId: sample.pointerId,
      point: sample.point,
      modifiers: sample.modifiers,
    })
  }, [controller])

  const finishPointerSession = useCallback((
    session: ActivePointerSession,
    event: Pick<PointerEvent, 'clientX' | 'clientY' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>,
  ) => {
    if (
      activePointerSessionRef.current?.generation !== session.generation
      || session.status !== 'active'
    ) return
    session.status = 'finishing'
    session.buttons = 0
    clearPending(session.generation)
    // 某些浏览器会在 PointerEvent 的 pointerup 上遗漏已按住的修饰键；手势期间的
    // window keydown/keyup 是可靠来源。keyup 已发生时 lastModifiers 会即时恢复为 false。
    const releaseModifiers = modifiers(event)
    controller.send({
      type: 'pointer.up',
      pointerId: session.pointerId,
      point: screenPointFromRect(event, session.surfaceRect),
      modifiers: {
        ...releaseModifiers,
        shift: releaseModifiers.shift || session.lastModifiers.shift,
      },
    })
    if (activePointerSessionRef.current?.generation === session.generation) {
      endPointerSession(session)
    }
  }, [clearPending, controller, endPointerSession])

  const cancelPointerSession = useCallback((
    session: ActivePointerSession,
    captureAlreadyLost = false,
  ) => {
    if (
      activePointerSessionRef.current?.generation !== session.generation
      || session.status === 'ended'
    ) return
    session.status = 'ended'
    if (captureAlreadyLost) session.captureOwned = false
    clearPending(session.generation)
    controller.send({ type: 'pointer.cancel', pointerId: session.pointerId })
    if (activePointerSessionRef.current?.generation === session.generation) {
      endPointerSession(session)
    }
  }, [clearPending, controller, endPointerSession])

  const installPointerRoute = useCallback((session: ActivePointerSession) => {
    stopPointerRoute()
    const currentSession = (event: PointerEvent) => {
      const current = activePointerSessionRef.current
      return current?.generation === session.generation
        && current.pointerId === event.pointerId
        ? current
        : null
    }
    const handleMove = (event: PointerEvent) => {
      const current = currentSession(event)
      if (!current || current.status !== 'active') return
      current.buttons = event.buttons
      if (event.buttons === 0) {
        finishPointerSession(current, event)
        return
      }
      scheduleUpdate(current, event)
    }
    const handleUp = (event: PointerEvent) => {
      const current = currentSession(event)
      if (current) finishPointerSession(current, event)
    }
    const handleCancel = (event: PointerEvent) => {
      const current = currentSession(event)
      if (current) cancelPointerSession(current, true)
    }
    const handleModifierChange = (event: KeyboardEvent) => {
      const current = activePointerSessionRef.current
      if (current?.generation === session.generation) refreshDrawingModifier(current, event)
    }
    // capture phase 先于 React 根节点回调，避免宿主 stopPropagation 使内部路由漏掉最终点。
    window.addEventListener('pointermove', handleMove, true)
    window.addEventListener('pointerup', handleUp, true)
    window.addEventListener('pointercancel', handleCancel, true)
    window.addEventListener('keydown', handleModifierChange, true)
    window.addEventListener('keyup', handleModifierChange, true)
    pointerRouteCleanupRef.current = () => {
      window.removeEventListener('pointermove', handleMove, true)
      window.removeEventListener('pointerup', handleUp, true)
      window.removeEventListener('pointercancel', handleCancel, true)
      window.removeEventListener('keydown', handleModifierChange, true)
      window.removeEventListener('keyup', handleModifierChange, true)
    }
  }, [
    cancelPointerSession,
    finishPointerSession,
    refreshDrawingModifier,
    scheduleUpdate,
    stopPointerRoute,
  ])

  const capturePointer = useCallback((root: HTMLDivElement, pointerId: number) => {
    const start = pendingPointerStartRef.current
    const surface = surfaceRef.current
    if (!surface) return
    const session: ActivePointerSession = {
      pointerId,
      generation: ++pointerGenerationRef.current,
      buttons: start?.pointerId === pointerId ? start.buttons : 1,
      lastPoint: start?.pointerId === pointerId ? start.point : { x: 0, y: 0 },
      lastModifiers: start?.pointerId === pointerId
        ? start.modifiers
        : { shift: false, alt: false, command: false },
      status: 'active',
      surfaceRect: start?.pointerId === pointerId
        ? start.surfaceRect
        : frozenSurfaceRect(surface),
      captureOwned: false,
    }
    activePointerSessionRef.current = session
    installPointerRoute(session)
    try {
      if (typeof root.setPointerCapture === 'function') {
        root.setPointerCapture(pointerId)
        session.captureOwned = true
      }
    }
    catch {
      // capture 是传输优化；失败后 window 路由仍拥有完整手势生命周期。
    }
  }, [installPointerRoute])

  const createDroppedAssets = useCallback(async (
    effect: Extract<StageInteractionEffect, { readonly type: 'external.drop' }>,
  ) => {
    if (effect.item.kind !== 'assets' || effect.item.items.length === 0) return
    const started = latestRef.current
    const resolver: ComposeAssetResolver | undefined = started.assetResolver
    if (!resolver) {
      setAssetDropStatus(
        resolvedLocale === 'en-US'
          ? 'Assets could not be added: no asset resolver is connected.'
          : '无法添加资源：未连接资源解析器。',
      )
      return
    }
    const request = new AbortController()
    pendingAssetDropsRef.current.add(request)
    try {
      const results = await mapWithConcurrency(effect.item.items, 4, async (item) => {
        const reference: ComposeAssetReference = {
          providerId: item.providerId,
          assetKey: item.assetKey,
          scope: item.scope,
        }
        try {
          const resolved: ComposeResolvedAsset = await resolver.resolve({
            reference,
            signal: request.signal,
          })
          const created = await started.registry.createAssetSeed({
            reference,
            resolved,
            name: item.name,
          })
          return created.ok
            ? { ok: true as const, value: { reference, seed: created.seed } }
            : { ok: false as const }
        }
        catch {
          return { ok: false as const }
        }
      })
      if (request.signal.aborted || latestRef.current.assetResolver !== resolver) return
      const successful = results.flatMap((result) => result.ok ? [result.value] : [])
      const failedCount = results.length - successful.length
      if (successful.length === 0) {
        setAssetDropStatus(
          resolvedLocale === 'en-US'
            ? `No assets were added. ${failedCount} failed.`
            : `未添加任何资源，${failedCount} 项失败。`,
        )
        return
      }

      const current = latestRef.current
      const target = effect.parentId
        ? current.document.entities[effect.parentId]
        : undefined
      const parent = target
        && getComposeHierarchy(target)
        && getComposeVisibility(target).visible
        && !getComposeLock(target).locked
        ? target
        : undefined
      const inverseParent = parent
        ? invertMatrix(getEntityWorldMatrix(
            current.document,
            current.layoutSnapshot,
            parent.id,
          ))
        : null
      const offsets = assetSeedCenters(successful)
      const placements = successful.map(({ seed }, index) => {
        const offset = offsets[index]!
        const worldCenter = {
          x: effect.worldPoint.x + offset.x,
          y: effect.worldPoint.y + offset.y,
        }
        const entityId = current.idFactory()
        const build = (center: StagePoint) => entityFromSeed(
          seed,
          entityId,
          center,
          parent ? getComposeLayout(parent) : undefined,
        )
        if (parent) {
          return { entity: build(applyMatrix(inverseParent!, worldCenter)), parentId: parent.id }
        }
        const landing = resolveRootLanding(
          current,
          seedWorldBounds(seed, worldCenter),
          (bounds) => build(boundsCenter(bounds)),
        )
        return landing
          ? { entity: landing.entity, parentId: landing.parentId }
          : { entity: build(worldCenter), parentId: null }
      })
      const entities = placements.map(({ entity }) => entity)
      const commands: EditorCommand[] = placements.map(({ entity, parentId }) => ({
        id: current.idFactory(),
        type: BUILTIN_COMMAND_TYPES.createEntity,
        payload: {
          entity: entity as unknown as JsonValue,
          parentId,
        },
        meta: {
          label: describeEntityCreation(entity),
          source: 'asset-browser',
          targetIds: [entity.id],
        },
      }))
      const result = current.dispatch({
        id: current.idFactory(),
        type: BUILTIN_COMMAND_TYPES.batch,
        payload: {
          commands: commands as unknown as JsonValue,
        },
        meta: {
          label: resolvedLocale === 'en-US'
            ? `Add ${entities.length} asset${entities.length === 1 ? '' : 's'}`
            : `添加 ${entities.length} 个资源`,
          source: 'asset-browser',
          targetIds: entities.map((entity) => entity.id),
        },
      })
      if (result.status === 'committed') {
        current.onSelectedIdsChange(entities.map((entity) => entity.id))
      }
      else {
        setAssetDropStatus(
          resolvedLocale === 'en-US'
            ? `No assets were added. ${results.length} failed.`
            : `未添加任何资源，${results.length} 项失败。`,
        )
        return
      }
      setAssetDropStatus(
        failedCount === 0
          ? resolvedLocale === 'en-US'
            ? `${entities.length} asset${entities.length === 1 ? '' : 's'} added.`
            : `已添加 ${entities.length} 个资源。`
          : resolvedLocale === 'en-US'
            ? `${entities.length} added, ${failedCount} failed.`
            : `已添加 ${entities.length} 项，${failedCount} 项失败。`,
      )
    }
    finally {
      pendingAssetDropsRef.current.delete(request)
    }
  }, [resolvedLocale])

  const createDrawing = useCallback((
    effect: Extract<StageInteractionEffect, { readonly type: 'drawing.commit' }>,
  ) => {
    const current = latestRef.current
    const seedResult = current.registry.createSeed(presetForDrawingTool(effect.tool))
    if (!seedResult.ok) return
    const parentCandidate = effect.parentId
      ? current.document.entities[effect.parentId]
      : undefined
    const parent = parentCandidate
      && getComposeHierarchy(parentCandidate)
      && !getComposeLock(parentCandidate).locked
      && getComposeVisibility(parentCandidate).visible
      ? parentCandidate
      : undefined
    const inverseParent = parent
      ? invertMatrix(getEntityWorldMatrix(
          current.document,
          current.layoutSnapshot,
          parent.id,
        ))
      : null
    const drawnBounds = boundsInParentSpace(effect.bounds, inverseParent)
    // 容器单击不拖时落到 Preset 默认尺寸；文字有自己的 Hug 语义，其余图形保持精确 bounds。
    const localBounds = effect.tool === 'draw-container'
      ? expandClickDrawingBounds(seedResult.seed, drawnBounds)
      : drawnBounds
    const entityId = current.idFactory()
    const buildEntity = (bounds: StageRect) => {
      const textClick = effect.tool === 'draw-text' && bounds.width < 1 && bounds.height < 1
      const drawnEntity = entityFromDrawingSeed(
        seedResult.seed,
        entityId,
        bounds,
        effect.tool === 'draw-line' || effect.tool === 'draw-arrow'
          ? {
              x: directionAxis(effect.end.x - effect.start.x),
              y: directionAxis(effect.end.y - effect.start.y),
            }
          : undefined,
        textClick
          ? {
              preserveHugSizing: true,
              // 点击创建即刻进入编辑，占位文案会逼用户先全选删除；Prop 名从 Registry 查，
              // Stage 不认识具体物料类型。
              emptyTextPropName:
                current.registry.getEditableTextPropName({
                  ...seedResult.seed,
                  id: entityId,
                }) ?? undefined,
            }
          : undefined,
      )
      // 组件库中的 Rectangle 可保留其圆角默认值；画布矩形工具遵循设计工具惯例，初始绘制为直角。
      return effect.tool === 'draw-rectangle'
        ? {
            ...drawnEntity,
            components: {
              ...drawnEntity.components,
              Appearance: {
                ...resolveComposeAppearance(drawnEntity),
                borderRadius: 0,
              },
            },
          }
        : drawnEntity
    }
    // 命中容器时照常做子级；落在所有场景之外时按类型分流：容器升格成新场景，其余落进激活场景。
    const landing = parent ? null : resolveRootLanding(current, localBounds, buildEntity)
    const entity = landing?.entity ?? buildEntity(localBounds)
    const result = current.dispatch({
      id: current.idFactory(),
      type: BUILTIN_COMMAND_TYPES.createEntity,
      payload: {
        entity: entity as unknown as JsonValue,
        // 升格分支的 parentId 就是 null（文档根），不能用 ?? 串下去——那会把新场景吞回
        // rootIds[0] 里变成嵌套 Frame。
        parentId: parent ? parent.id : landing ? landing.parentId : null,
      },
      meta: {
        label: describeEntityCreation(entity),
        source: 'stage',
        targetIds: [entity.id],
      },
    })
    if (result.status === 'committed') {
      current.onSelectedIdsChange([entity.id])
      // Controller 发 drawing.commit 时并不铸 ID，拿不到新 Entity；回灌后它才能判断
      // 「这次点击创建的是文字，应当立刻进入编辑」。按 entityId 去重由 Controller 负责。
      setLastDrawn({ entityId: entity.id, tool: effect.tool })
      // 单次绘制结束即回到选择模式，避免下一次点击意外继续创建同类图形。
      onToolChange?.('select')
    }
  }, [onToolChange])

  const commitSegment = useCallback((
    effect: Extract<StageInteractionEffect, { readonly type: 'segment.commit' }>,
  ) => {
    const current = latestRef.current
    const entity = current.document.entities[effect.entityId]
    const renderer = entity ? getComposeRenderer(entity) : null
    const currentSegment = lineSegmentForEntity(
      current.document,
      current.layoutSnapshot,
      effect.entityId,
    )
    const next = lineSegmentTransform(
      current.document,
      current.layoutSnapshot,
      effect,
    )
    if (
      !entity
      || !renderer
      || renderer.type !== 'shape'
      || !currentSegment
      || !next
      || getComposeLock(entity).locked
      || (
        currentSegment.start.x === effect.start.x
        && currentSegment.start.y === effect.start.y
        && currentSegment.end.x === effect.end.x
        && currentSegment.end.y === effect.end.y
      )
    ) return
    current.dispatch({
      id: current.idFactory(),
      type: 'transaction.batch',
      payload: {
        commands: [
          {
            id: current.idFactory(),
            type: BUILTIN_COMMAND_TYPES.setTransform,
            payload: {
              operation: 'resize',
              updates: [{
                entityId: entity.id,
                transform: toComposeTransform(next.transform),
              }],
            },
          },
          {
            id: current.idFactory(),
            type: BUILTIN_COMMAND_TYPES.setRendererProps,
            payload: {
              entityId: entity.id,
              props: {
                ...renderer.props,
                direction: next.direction,
              },
            },
          },
        ] as unknown as JsonValue,
      },
      meta: {
        label: `Resize ${entity.name} endpoints`,
        mergeKey: `stage:segment:${entity.id}`,
        source: 'stage',
        targetIds: [entity.id],
      },
    })
  }, [])

  useEffect(() => controller.connectSurface({
    resolveClientPoint(point) {
      const surface = surfaceRef.current
      return surface ? resolveClientPoint(point, surface) : null
    },
    applyEffects(effects: readonly StageInteractionEffect[]) {
      const current = latestRef.current
      effects.forEach((effect) => {
        if (effect.type === 'pointer.capture') {
          const root = rootRef.current
          if (root) capturePointer(root, effect.pointerId)
          return
        }
        if (effect.type === 'pointer.release') {
          releasePointer(effect.pointerId)
          return
        }
        if (effect.type === 'viewport.change') {
          current.onViewportChange(effect.viewport)
          return
        }
        if (effect.type === 'selection.change') {
          current.onSelectedIdsChange(effect.selectedIds)
          return
        }
        if (effect.type === 'paint.sample.complete') {
          current.onPaintSamplingComplete?.()
          return
        }
        if (effect.type === 'path.change') {
          current.onEditablePathChange?.({
            vertexId: effect.vertexId,
            handle: effect.handle,
            phase: effect.phase,
            worldPoint: effect.worldPoint,
            modifiers: effect.modifiers,
          })
          return
        }
        if (effect.type === 'path.vertex-toggle') {
          current.onEditablePathVertexToggle?.(effect.vertexId)
          return
        }
        if (effect.type === 'command.dispatch') {
          current.dispatch(effect.command)
          return
        }
        if (effect.type === 'segment.commit') {
          commitSegment(effect)
          return
        }
        if (effect.type === 'drawing.commit') {
          createDrawing(effect)
          return
        }
        if (effect.type === 'text-editing.enter') {
          enterTextEditing(effect.entityId)
          return
        }
        if (effect.type === 'text-editing.exit') {
          exitTextEditing()
          return
        }
        if (effect.item.kind === 'assets') {
          void createDroppedAssets(effect)
          return
        }
        const entityId = current.idFactory()
        const seed = current.registry.createSeed(effect.item.presetId)
        if (!seed.ok) return
        const parent = effect.parentId
          ? current.document.entities[effect.parentId]
          : undefined
        const validParent = parent
          && getComposeHierarchy(parent)
          && !getComposeLock(parent).locked
          && getComposeVisibility(parent).visible
          ? parent
          : undefined
        const buildEntity = (center: StagePoint) => entityFromSeed(
          seed.seed,
          entityId,
          center,
          validParent ? getComposeLayout(validParent) : undefined,
        )
        // 命中容器时照常做子级；落在所有场景之外时按类型分流，与绘制工具同一条规则。
        const landing = validParent
          ? null
          : resolveRootLanding(
              current,
              seedWorldBounds(seed.seed, effect.worldPoint),
              (bounds) => buildEntity(boundsCenter(bounds)),
            )
        const entity = landing?.entity ?? buildEntity(validParent
          ? applyMatrix(
              invertMatrix(getEntityWorldMatrix(
                current.document,
                current.layoutSnapshot,
                validParent.id,
              )),
              effect.worldPoint,
            )
          : effect.worldPoint)
        const result = current.dispatch({
          id: current.idFactory(),
          type: BUILTIN_COMMAND_TYPES.createEntity,
          payload: {
            entity: entity as unknown as JsonValue,
            // 升格分支的 parentId 是 null（文档根），不能用 ?? 串下去。
            parentId: validParent ? validParent.id : landing ? landing.parentId : null,
          },
          meta: {
            label: describeEntityCreation(entity),
            source: 'component-palette',
            targetIds: [entityId],
          },
        })
        if (result.status === 'committed') {
          current.onSelectedIdsChange([entityId])
        }
      })
    },
  }), [
    capturePointer,
    commitSegment,
    controller,
    createDrawing,
    createDroppedAssets,
    enterTextEditing,
    exitTextEditing,
    releasePointer,
  ])

  // 引擎只需要会话（entityId + 活动顶点），几何直接交给 Overlay。memo 保持引用稳定，
  // 避免每次渲染都触发 updateContext 的手势兼容性检查。
  const editablePathEntityId = editablePath?.entityId ?? null
  const pathEditing = useMemo(
    () => (editablePathEntityId === null
      ? null
      : {
          entityId: editablePathEntityId,
          ...(editablePathActiveVertexId !== null
            ? { activeVertexId: editablePathActiveVertexId }
            : {}),
        }),
    [editablePathEntityId, editablePathActiveVertexId],
  )

  useLayoutEffect(() => {
    controller.updateContext({
      document,
      layoutSnapshot,
      hiddenEntityIds,
      viewport,
      surfaceSize,
      tool,
      marqueeMode,
      lockGestureParent,
      selectedIds: normalizedSelection,
      paintEditing,
      paintSampling,
      pathEditing,
      textEditing,
      drawnEntity: lastDrawn,
      contentReflowsWithWidth,
      isTextEditable,
      idFactory,
      labels: {
        createGuide: messages.createGuide,
        createGuides: messages.createGuides,
        moveGuide: messages.moveGuide,
        deleteGuide: messages.deleteGuide,
      },
    })
  }, [
    contentReflowsWithWidth,
    controller,
    document,
    hiddenEntityIds,
    isTextEditable,
    lastDrawn,
    layoutSnapshot,
    idFactory,
    messages.createGuide,
    messages.createGuides,
    messages.deleteGuide,
    messages.moveGuide,
    lockGestureParent,
    marqueeMode,
    normalizedSelection,
    paintEditing,
    paintSampling,
    pathEditing,
    surfaceSize,
    textEditing,
    tool,
    viewport,
  ])

  useFinalControllerDisposal(privateController)

  useEffect(() => () => {
    const session = activePointerSessionRef.current
    if (session) {
      session.captureOwned = false
      endPointerSession(session)
    }
    else {
      clearPending()
      stopPointerRoute()
    }
  }, [clearPending, controller, endPointerSession, stopPointerRoute])

  const cancelGesture = () => {
    const session = activePointerSessionRef.current
    if (session) cancelPointerSession(session)
    else controller.send({ type: 'pointer.cancel' })
  }

  const beginInteraction = (
    hit: StageInteractionHit,
    event: ReactPointerEvent<Element>,
  ) => {
    const surface = surfaceRef.current
    if (!surface || activePointerSessionRef.current) return
    const surfaceRect = frozenSurfaceRect(surface)
    const start = {
      pointerId: event.pointerId,
      buttons: pressedButtons(event.button, event.buttons),
      surfaceRect,
      point: screenPointFromRect(event, surfaceRect),
      modifiers: modifiers(event),
    }
    pendingPointerStartRef.current = start
    // 归一化连击计数：`event.detail` 在 pointerdown 上恒为 0，测试用例可显式给出。
    const now = event.timeStamp || Date.now()
    const previous = lastPointerDownRef.current
    const clickCount = event.detail > 0
      ? event.detail
      : previous
        && now - previous.time <= DOUBLE_CLICK_INTERVAL_MS
        && Math.abs(event.clientX - previous.x) <= DOUBLE_CLICK_SLOP_PX
        && Math.abs(event.clientY - previous.y) <= DOUBLE_CLICK_SLOP_PX
        ? previous.count + 1
        : 1
    lastPointerDownRef.current = {
      time: now,
      x: event.clientX,
      y: event.clientY,
      count: clickCount,
    }
    try {
      controller.send({
        type: 'pointer.down',
        pointerId: event.pointerId,
        button: event.button,
        point: start.point,
        hit,
        modifiers: start.modifiers,
        clickCount,
      })
    }
    finally {
      if (pendingPointerStartRef.current === start) {
        pendingPointerStartRef.current = null
      }
    }
  }

  /**
   * 读取本次 pointerdown 的连击计数而不推进状态。
   *
   * @remarks
   * 真正的计数推进仍由 beginInteraction 负责；这里只做前瞻判断，两者读的是同一份 ref，
   * 因此结果一致。若在这里推进，beginInteraction 会再算一次导致计数翻倍。
   */
  const peekClickCount = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.detail > 0) return event.detail
    const previous = lastPointerDownRef.current
    const now = event.timeStamp || Date.now()
    return previous
      && now - previous.time <= DOUBLE_CLICK_INTERVAL_MS
      && Math.abs(event.clientX - previous.x) <= DOUBLE_CLICK_SLOP_PX
      && Math.abs(event.clientY - previous.y) <= DOUBLE_CLICK_SLOP_PX
      ? previous.count + 1
      : 1
  }

  const beginEntity = (entity: ComposeEntity, event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    // 下钻上下文不能从选区推导：一次双击的第一个 pointerdown 计数为奇数、不触发下钻，
    // 它会先把选区重置回实例本身，随后的偶数 pointerdown 就再也看不到当前层级。
    if (drillContextRef.current && drillContextRef.current.instanceId !== entity.id) {
      drillContextRef.current = null
    }
    // 双击关联组件实例逐层下钻到内部实体。内部内容 pointer-events 关闭且几何不在场景索引里，
    // 因此命中读 DOM；命中失败时不拦截，落回实例整体的普通选择。
    if (
      tool === 'select'
      && isComponentInstanceEntity(entity)
      // 一次双击由两个 pointerdown 组成，只在偶数计数上下钻，保证一次双击恰好前进一层；
      // 用 >= 2 会让 count 2 和 3 各触发一次，一次双击直接跳两层。
      && peekClickCount(event) % 2 === 0
    ) {
      const path = resolveInstanceDrillDownPath(
        event.currentTarget,
        { x: event.clientX, y: event.clientY },
      )
      const context = drillContextRef.current
      const innerId = nextInstanceDrillDownTarget(
        path,
        context?.instanceId === entity.id ? context.innerId : null,
      )
      if (innerId !== null) {
        drillContextRef.current = { instanceId: entity.id, innerId }
        onSelectedIdsChange([encodeComposeInstancePath([entity.id, innerId])])
        return
      }
    }
    beginInteraction({ kind: 'entity', entityId: entity.id }, event)
  }

  // 标签命中不参与非空容器的框选收敛：它是这类容器唯一的选中入口。
  const beginContainerLabel = (entityId: string, event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation()
    beginInteraction({ kind: 'entity', entityId, source: 'label' }, event)
  }

  const screenBounds = bounds
    ? {
        ...worldToScreen(bounds, viewport),
        width: bounds.width * viewport.zoom,
        height: bounds.height * viewport.zoom,
    }
    : null
  // v7 没有文档级输出：每个根 Frame 各自画一圈可检查边界。
  const boundarySceneIndex = createStageSceneIndex(document, layoutSnapshot, hiddenEntityIds)
  const frameScreenBounds = document.rootIds.flatMap((frameId) => {
    const worldBounds = boundarySceneIndex.getWorldBounds(frameId)
    if (!worldBounds) return []
    const screen = worldToScreen(worldBounds, viewport)
    return [{
      frameId,
      x: screen.x,
      y: screen.y,
      width: worldBounds.width * viewport.zoom,
      height: worldBounds.height * viewport.zoom,
    }]
  })
  const worldOriginScreen = worldToScreen({ x: 0, y: 0 }, viewport)
  const marqueeScreen = marquee
    ? {
        ...worldToScreen(marquee, viewport),
        width: marquee.width * viewport.zoom,
        height: marquee.height * viewport.zoom,
      }
    : null
  const handlePoints = screenBounds ? {
    nw: [screenBounds.x, screenBounds.y],
    n: [screenBounds.x + screenBounds.width / 2, screenBounds.y],
    ne: [screenBounds.x + screenBounds.width, screenBounds.y],
    e: [screenBounds.x + screenBounds.width, screenBounds.y + screenBounds.height / 2],
    se: [screenBounds.x + screenBounds.width, screenBounds.y + screenBounds.height],
    s: [screenBounds.x + screenBounds.width / 2, screenBounds.y + screenBounds.height],
    sw: [screenBounds.x, screenBounds.y + screenBounds.height],
    w: [screenBounds.x, screenBounds.y + screenBounds.height / 2],
  } satisfies Record<ResizeHandle, readonly [number, number]> : null
  const horizontalTicks = createRulerTicks({
    axis: 'x',
    viewport,
    length: surfaceSize.width,
    step: document.canvas.grid.stepX,
    offset: document.canvas.grid.offsetX,
    primaryLineEvery: document.canvas.grid.primaryLineEvery,
  })
  const verticalTicks = createRulerTicks({
    axis: 'y',
    viewport,
    length: surfaceSize.height,
    step: document.canvas.grid.stepY,
    offset: document.canvas.grid.offsetY,
    primaryLineEvery: document.canvas.grid.primaryLineEvery,
  })
  const previewById = new Map(guidePreview.map((guide) => [guide.id, guide]))
  // 辅助线保存在活动 Frame 的局部坐标里；Overlay 在世界坐标绘制，因此这里映射一次。
  const targetFrameId = resolveTargetFrameId(document, selectedIds, activeFrameId)
  const worldGuides = listFrameWorldGuides(document, targetFrameId, boundarySceneIndex)
    .map((guide) => ({ id: guide.id, axis: guide.axis, position: guide.value }))
  const canvasGuides = [
    ...worldGuides.map((guide) => previewById.get(guide.id) ?? guide),
    ...guidePreview.filter((guide) => !worldGuides.some(({ id }) => id === guide.id)),
  ]
  const visibleWidth = surfaceSize.width / viewport.zoom
  const visibleHeight = surfaceSize.height / viewport.zoom
  const visibleWorld = {
    ...screenToWorld({ x: 0, y: 0 }, viewport),
    width: visibleWidth,
    height: visibleHeight,
  }
  // 内容边界要遍历全部 Entity 计算世界包围盒，但只在引擎尚未发布滚动范围的首帧才会用到。
  // 必须惰性求值：否则每个平移帧都会为一个立刻被丢弃的结果做一次全场景遍历。
  const bootstrapContentBounds = () => unionRects([
    ...Object.values(previewDocument.entities)
      .filter((entity) => getComposeVisibility(entity).visible)
      .map((entity) => getEntityWorldBounds(
        previewDocument,
        previewLayoutSnapshot,
        entity.id,
      )),
  ])
  const activeScrollRange = interaction.scrollRange
    ?? expandScrollRange(null, bootstrapContentBounds(), visibleWorld)
  const scrollAxes = viewportToScrollAxes(viewport, surfaceSize, activeScrollRange)

  const { executeClipboard, availabilityFor } = useStageClipboard({
    activeFrameId,
    clipboard: clipboardProp,
    dispatch,
    document,
    idFactory,
    layoutSnapshot,
    normalizedSelection,
    onClipboardChange,
    onSelectedIdsChange,
    onShortcutAction,
  })
  const clipboardAvailability = availabilityFor(contextNodeId)

  // 必须排在 executeClipboard 与 cancelGesture 之后：键盘级联把它们当依赖接收，而不是
  // 靠闭包在渲染函数里就近取用。
  const {
    onKeyDown: keyboardCommand,
    onKeyUp: keyboardRelease,
    stopTemporaryPan,
  } = useStageKeyboardCommands({
    cancelGesture,
    controller,
    dispatch,
    document,
    executeClipboard,
    hiddenEntityIds,
    idFactory,
    isTextEditing: isTextEditingActive,
    layoutSnapshot,
    messages,
    normalizedSelection,
    onKeyDown,
    onSelectedIdsChange,
    onShortcutAction,
    onToolChange,
    onViewportChange,
    selectionBounds: bounds,
    shortcuts: resolvedShortcuts,
    surfaceSize,
    viewport,
  })

  // 失焦要同时结束临时平移与取消指针会话，两者必须留在同一个监听器里：拆成两个 blur
  // 监听器，其相对顺序就变成了 effect 注册顺序的副产品。
  useEffect(() => {
    const handleBlur = () => {
      stopTemporaryPan()
      const session = activePointerSessionRef.current
      if (session) cancelPointerSession(session)
      else controller.send({ type: 'pointer.cancel' })
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [cancelPointerSession, controller, stopTemporaryPan])

  return (
    <div
      {...props}
      aria-label={props['aria-label'] ?? 'Stage'}
      className={['compose-stage', className].filter(Boolean).join(' ')}
      data-compose-theme={theme?.resolvedTheme}
      data-interaction-cursor={interaction.cursor}
      data-interaction-phase={interaction.phase}
      id={id}
      lang={resolvedLocale}
      ref={rootRef}
      role="application"
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
      } as CSSProperties}
      tabIndex={0}
      onContextMenu={(event) => {
        props.onContextMenu?.(event)
        // ContextMenu 的 Portal 在 React 事件树中仍会冒泡到 Stage；不能把菜单自身的右键
        // 当作新的画布右键，否则会重置根菜单。
        if (event.defaultPrevented || !rootRef.current?.contains(event.target as Node)) return
        // 标签用独立属性标记归属：data-entity-id 必须唯一指向 Scene 里的那个节点，
        // 否则任何按实体查询 DOM 的地方都会同时命中标签。
        const target = (event.target as Element)
          .closest<HTMLElement>('[data-entity-id],[data-label-entity-id]')
        const entityId = target?.dataset.entityId ?? target?.dataset.labelEntityId ?? null
        if (entityId && !normalizedSelection.includes(entityId)) {
          onSelectedIdsChange([entityId])
        }
        event.preventDefault()
        contextMenu.openAt(event, entityId)
      }}
      onKeyDown={keyboardCommand}
      onKeyUp={keyboardRelease}
      onLostPointerCapture={(event) => {
        onLostPointerCapture?.(event)
        if (event.target !== event.currentTarget) return
        const session = activePointerSessionRef.current
        const expected = expectedLostCaptureRef.current.get(event.pointerId)
        const expectedGeneration = expected?.[0]
        if (
          event.buttons === 0
          && expectedGeneration !== undefined
          && (
            !session
            || session.status !== 'active'
            || expectedGeneration < session.generation
          )
        ) {
          expected!.shift()
          if (expected!.length === 0) {
            expectedLostCaptureRef.current.delete(event.pointerId)
          }
          return
        }
        if (
          !session
          || session.pointerId !== event.pointerId
          || session.status !== 'active'
        ) return
        if (event.buttons === 0) {
          session.captureOwned = false
          finishPointerSession(session, event.nativeEvent)
          return
        }
        stopTemporaryPan()
        cancelPointerSession(session, true)
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event)
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        const surface = surfaceRef.current
        if (
          event.defaultPrevented
          || !surface
          || (event.target !== surface && event.target !== event.currentTarget)
        ) return
        // Portal 中子菜单的 pointerdown 会沿 React 树冒泡到此处；仅真实画布点击才夺取焦点，
        // 否则触发项失焦会让二级菜单立即关闭。
        event.currentTarget.focus({ preventScroll: true })
        beginInteraction({ kind: 'surface' }, event)
      }}
      onPointerMove={(event) => {
        // 指针位置是瞬时视图状态：走命令式接口直接重绘标尺，不进 React state，也不入文档。
        const surface = surfaceRef.current
        if (surface) rulersRef.current?.setCursor(screenPoint(event, surface))
        onPointerMove?.(event)
      }}
      onPointerLeave={() => { rulersRef.current?.setCursor(null) }}
      onPointerUp={(event) => {
        onPointerUp?.(event)
      }}
      onWheel={onWheel}
    >
      {layoutSnapshot.diagnostics.length > 0 ? (
        <span
          data-testid="stage-layout-diagnostics"
          role="status"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clipPath: 'inset(50%)',
          }}
        >
          {layoutSnapshot.diagnostics.map(({ message }) => message).join('；')}
        </span>
      ) : null}
      <StageRulers
        bounds={bounds}
        horizontalTicks={horizontalTicks}
        ref={rulersRef}
        themeKey={theme?.resolvedTheme}
        labels={{
          origin: messages.rulerOrigin,
          horizontal: messages.horizontalRuler,
          vertical: messages.verticalRuler,
        }}
        screenBounds={screenBounds}
        verticalTicks={verticalTicks}
        onCornerPointerDown={(event) => {
          event.stopPropagation()
          beginInteraction({ kind: 'ruler-corner' }, event)
        }}
        onHorizontalPointerDown={(event) => {
          event.stopPropagation()
          beginInteraction({ kind: 'ruler', axis: 'x' }, event)
        }}
        onVerticalPointerDown={(event) => {
          event.stopPropagation()
          beginInteraction({ kind: 'ruler', axis: 'y' }, event)
        }}
      />
      <div
        className="compose-stage__surface"
        data-testid="stage-surface"
        id={surfaceId}
        ref={surfaceRef}
      >
        <div
          aria-hidden="true"
          className="compose-stage__grid"
          data-testid="stage-grid"
          style={gridVisible
            ? createVisualGridStyle(document.canvas.grid, viewport)
            : { display: 'none' }}
        />
        <svg aria-hidden="true" className="compose-stage__world-overlay">
          {/*
            * 场景与容器共用同一条呈现管线：背景、边框、圆角都来自 Entity 自身的 Appearance，
            * Stage 不为 Frame 补画任何容器得不到的装饰。这里只保留一个透明矩形标出场景区域
            * ——它是「可检查边界」的锚点，pointerEvents 关掉，否则会吞掉绘制工具的按下。
            */}
          {frameScreenBounds.map((frameBounds) => (
            <rect
              className="compose-stage__output-boundary"
              data-frame-id={frameBounds.frameId}
              data-testid={`stage-frame-boundary-${frameBounds.frameId}`}
              fill="transparent"
              height={frameBounds.height}
              key={frameBounds.frameId}
              style={{ pointerEvents: 'none' }}
              width={frameBounds.width}
              x={frameBounds.x}
              y={frameBounds.y}
            />
          ))}
          <line
            className="compose-stage__axis is-x"
            data-testid="stage-origin-x"
            x1="0"
            x2="100%"
            y1={worldToScreen({ x: 0, y: 0 }, viewport).y}
            y2={worldToScreen({ x: 0, y: 0 }, viewport).y}
          />
          <line
            className="compose-stage__axis is-y"
            data-testid="stage-origin-y"
            x1={worldToScreen({ x: 0, y: 0 }, viewport).x}
            x2={worldToScreen({ x: 0, y: 0 }, viewport).x}
            y1="0"
            y2="100%"
          />
          <g
            aria-hidden="true"
            className="compose-stage__world-origin"
            data-testid="stage-world-origin"
            transform={`translate(${
              worldOriginScreen.x - WORLD_ORIGIN_ICON_HALF_SIZE
            } ${
              worldOriginScreen.y - WORLD_ORIGIN_ICON_HALF_SIZE
            })`}
          >
            <path
              d="M6 0v4.42A4 4 0 0 0 4.42 6H0v4h4.42A4 4 0 0 0 6 11.58V16h4v-4.42A4 4 0 0 0 11.58 10H16V6h-4.42A4 4 0 0 0 10 4.42V0Z"
              data-testid="stage-world-origin-silhouette"
              fill="#20252d"
              fillOpacity="0.9"
            />
            <path
              d="M7 1v3a4 4 0 0 1 2 0V1Zm1 4a3 3 0 0 0 0 6 3 3 0 0 0 0-6ZM1 7v2h3a4 4 0 0 1 0-2H1Zm11 0a4 4 0 0 1 0 2h3V7Zm-5 8h2v-3a4 4 0 0 1-2 0Z"
              data-testid="stage-world-origin-position"
              fill="#a4acb7"
              fillOpacity="0.88"
            />
          </g>
        </svg>
        <StageSceneLayer
          assetResolver={assetResolver}
          document={previewDocument}
          hiddenEntityIds={hiddenEntityIds}
          layoutSnapshot={sceneLayoutSnapshot}
          pageLoader={pageLoader}
          paintPreview={interaction.paintPreview}
          registry={registry}
          scriptModuleLoader={scriptModuleLoader}
          scriptScope={scriptScope}
          textEditingEntityId={textEditing?.entityId ?? null}
          textEditingValue={textEditingValue}
          viewport={viewport}
          onEntityPointerDown={beginEntity}
          onTextEditingChange={changeTextEditing}
        />
        <ComposeContainerLabelLayer
          document={previewDocument}
          hiddenEntityIds={hiddenEntityIds}
          label={messages.containerLabels}
          layoutSnapshot={sceneLayoutSnapshot}
          renameLabel={messages.renameContainer}
          selectedIds={selectedIds}
          viewport={viewport}
          activeFrameId={activeFrameId}
          sceneActiveLabel={messages.sceneActive}
          sceneInactiveLabel={messages.sceneInactive}
          scenePreviewLabel={messages.scenePreview}
          onLabelPointerDown={beginContainerLabel}
          onRename={onEntityRename}
          onSceneActivate={onSceneActivate}
          onScenePreview={onScenePreview}
        />
        {assetDropStatus
          ? (
              <div className="compose-stage__asset-drop-status" role="status">
                {assetDropStatus}
              </div>
            )
          : null}
        <StageOverlay
          canvasGuides={canvasGuides}
          drawing={interaction.drawing}
          dropIndicator={dropIndicator}
          editableSelection={editableSelection}
          handlePoints={handlePoints}
          label={messages.editingOverlay}
          lineSelection={lineSelection}
          marqueeHitTest={interaction.marqueeHitTest}
          marqueeScreen={marqueeScreen}
          paintHandles={interaction.paintHandles}
          paintSample={interaction.paintSample}
          editablePath={editablePath}
          activePathVertexId={editablePathActiveVertexId}
          resizeHandles={resizeHandles}
          rotatable={selectionRotatable}
          rotationPreview={interaction.rotationPreview}
          instanceSelectionBounds={instanceSelectionBounds}
          screenBounds={screenBounds}
          snapGuides={snapGuides}
          textEditing={textEditing !== null}
          tool={tool}
          visibleResizeHandles={visibleResizeHandles}
          viewport={viewport}
          onInteraction={(hit, event) => {
            event.stopPropagation()
            beginInteraction(hit, event)
          }}
        />
      </div>
      <StageScrollbar
        axis="x"
        controls={surfaceId}
        label={messages.horizontalScrollbar}
        model={scrollAxes.x}
        trackLength={surfaceSize.width}
        onValueChange={(value) => onViewportChange(scrollAxisToViewport(viewport, 'x', value))}
      />
      <StageScrollbar
        axis="y"
        controls={surfaceId}
        label={messages.verticalScrollbar}
        model={scrollAxes.y}
        trackLength={surfaceSize.height}
        onValueChange={(value) => onViewportChange(scrollAxisToViewport(viewport, 'y', value))}
      />
      <div aria-hidden="true" className="compose-stage__scroll-corner" />
      <StageContextMenu
        activeFrameId={activeFrameId}
        clipboardAvailability={clipboardAvailability}
        contextNodeId={contextNodeId}
        dispatch={dispatch}
        document={document}
        editableIds={contextEditableIds}
        idFactory={idFactory}
        layoutSnapshot={layoutSnapshot}
        messages={messages}
        rootProps={contextMenu.rootProps}
        selectionBounds={bounds}
        shortcuts={resolvedShortcuts}
        surfaceSize={surfaceSize}
        tool={tool}
        viewport={viewport}
        onClipboardAction={executeClipboard}
        onCreateComponentIntent={onCreateComponentIntent}
        onSceneActivate={onSceneActivate}
        onSelectedIdsChange={onSelectedIdsChange}
        onToolChange={onToolChange}
        onViewportChange={onViewportChange}
      />
    </div>
  )
}
