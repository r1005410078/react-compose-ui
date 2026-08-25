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
  ComposeRendererMeasurementAdapter,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_CURVE_PICK_TOLERANCE,
  getComposeCurve,
  type ComposeLayoutSnapshot,
  type ComposeSize,
} from '@compose-ui/core'
import {
  createStageInteractionController,
  stageCurveOutline,
  createStageSceneIndex,
  getEntityWorldBounds,
  resolveStageDropIndicator,
  screenToWorld,
  scrollAxisToViewport,
  STAGE_ZOOM_RANGE,
  type StageDrawnEntity,
  type StageGripTarget,
  type StagePoint,
  type StageRect,
} from '@compose-ui/stage-engine'
import { fitViewportTo } from './stage-viewport-actions'
import type {
  ComposeStageKeybinding,
  ComposeStageShortcutAction,
  ComposeStagePolicy,
  ComposeStageProps,
} from '../types'
import { ComposeCommandLine } from '@compose-ui/components'
import { StageScrollbar } from '../scrollbar'
import { StageOverlay } from '../stage-overlay'
import { GRIP_PICK_RADIUS } from '../stage-overlay/overlay-geometry'
import {
  bootstrapSelectionBounds,
  useStagePreviewDocuments,
} from './preview-document'
import {
  DEFAULT_STAGE_SHORTCUTS,
  STAGE_SHORTCUT_ACTIONS,
  useStageKeyboardCommands,
} from './keyboard'
import {
  isStageSelectionEditable,
  isStageSelectionRotatable,
  resolveStageResizeHandles,
  resolveStageScreenModel,
  resolveStageSelectionConstraints,
  StageWorldUnderlay,
  unlockedStageIds,
} from './screen-model'
import { useStageHiddenEntityIds } from './use-stage-hidden-entities'
import { useStageInstanceDrilldown } from './instance-drilldown'
import { useComposeStageMeasurement, useFinalControllerDisposal } from './stage-lifecycle'
import { StageContextMenu } from './stage-context-menu'
import { useStageEffectDispatch } from './entity-creation'
import { StageDraftingOverlay, useStageDrafting } from '../drafting'
import { useStageGeometryEditing } from '../geometry-editing'
import type { StageGeometryEditing } from '../geometry-editing'
import { useStagePointerSession, useStageRootHandlers } from './pointer-session'
import { useStageTextEditing } from './use-stage-text-editing'
import { useStageClipboard } from './use-stage-clipboard'
import {
  ComposeCanvasRulers,
  resolveComposeCanvasCrosshair,
  useCanvasSurfaceSize,
  useCanvasWheelNavigation,
  type ComposeCanvasRulersHandle,
} from '@compose-ui/canvas-kit'
import { StageSceneLayer } from '../stage-scene-layer'
import { getStageMessages } from '../stage-i18n'
import { createVisualGridStyle } from '../grid-rendering'
import { ComposeContainerLabelLayer } from '../container-label-layer'


function defaultId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `stage-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** 宿主省略 policy 时的解构底座；共用常量避免每帧分配一个空对象。 */
const EMPTY_STAGE_POLICY: ComposeStagePolicy = Object.freeze({})


export function ComposeStage(props: ComposeStageProps) {
  const i18n = useComposeI18nContext()
  const measurementAdapter = useComposeStageMeasurement(props)
  if (!props.layoutSnapshot) {
    return (
      <div
        aria-busy={props.layoutError ? undefined : true}
        className={props.className}
        data-compose-ui="stage"
        role={props.layoutError ? 'alert' : 'status'}
      >
        {props.layoutError
          ?? getStageMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage).loadingLayoutEngine}
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
  commands,
  activeFrameId,
  paintEditing = null,
  paintSampling = null,
  onPaintSamplingComplete,
  editablePath = null,
  editablePathActiveVertexId = null,
  onEditablePathChange,
  onEditablePathVertexToggle,
  onSurfaceSizeChange,
  autoFitActiveFrame = true,
  showCrosshair = true,
  crosshairSize = 5,
  pickRadius = COMPOSE_CURVE_PICK_TOLERANCE,
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
    registry,
    scriptModuleLoader,
  } = services
  // policy 的每一项都有自身缺省值，宿主整体省略与逐项省略必须等价。
  const {
    gridVisible = true,
    lockGestureParent,
  } = policy ?? EMPTY_STAGE_POLICY
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const resolvedLocale = i18n?.locale ?? 'zh-CN'
  const messages = getStageMessages(resolvedLocale, i18n?.formatMessage)
  const generatedSurfaceId = useId()
  const surfaceId = id ? `${id}-surface` : generatedSurfaceId
  const rootRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const rulersRef = useRef<ComposeCanvasRulersHandle>(null)
  const [privateController] = useState(createStageInteractionController)
  const controller = interactionController ?? privateController
  const interaction = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  // 临时平移由键盘能力持有，而键盘 Hook 必须排在剪贴板之后声明，晚于指针会话。用 ref
  // 打破这个声明顺序上的环：指针会话只在事件发生时读取它，不在渲染期读取。
  const stopTemporaryPanRef = useRef<() => void>(() => {})
  const {
    beginInteraction,
    cancelGesture,
    capturePointer,
    handleLostPointerCapture,
    peekClickCount,
    releasePointer,
  } = useStagePointerSession({
    controller,
    rootRef,
    surfaceRef,
    // 失去 capture 而被迫取消时，临时平移也该结束——它不属于指针会话，但必须同批处理。
    onCaptureLostAbort: () => stopTemporaryPanRef.current(),
  })
  const marquee = interaction.marquee
  const snapGuides = interaction.snapGuides
  const guidePreview = interaction.guidePreview
  const { size: surfaceSize, measured: surfaceMeasured } = useCanvasSurfaceSize(
    surfaceRef,
    onSurfaceSizeChange,
  )
  /** 首次适配只发生一次；此后文档编辑、选择变化与窗口缩放都不再自动改视口。 */
  const autoFitDoneRef = useRef(false)
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
  /**
   * 把视口适配到一个世界矩形。
   *
   * @remarks
   * 键盘的「适配选择 / 适配容器」、右键菜单、场景尺寸提交后的适配与首次进入的激活场景适配
   * 共用 `fitViewportTo`，因此几条路径的留白与缩放钳制不可能各自漂移。目标无效时不发出任何
   * 视口变化。
   */
  const fitViewport = (target: StageRect | null) => {
    const next = fitViewportTo(target, surfaceSize)
    if (next) onViewportChange(next)
  }

  /*
   * 首次布局就绪后把视口适配到激活场景。
   *
   * 固定初始视口在任何真实场景尺寸下都不合适：1280×720 的场景在 100% 缩放下就已经超出可视
   * 区域，用户进来第一件事永远是手动缩放。适配一次之后就交还给受控视口——依赖列表里的
   * document/layoutSnapshot 每次编辑都会变，真正拦住重复触发的是 ref 而不是依赖。
   *
   * 必须等 `surfaceMeasured`：在此之前 surfaceSize 还是那份兜底的 900×600，按它算出来的
   * 缩放和真实可视区域没有关系，用户会看到画面先跳一次再定住。
   */
  useEffect(() => {
    if (!autoFitActiveFrame || autoFitDoneRef.current || !surfaceMeasured) return
    // 激活场景缺省或已失效时回退第一块根 Frame，与 resolveTargetFrameId 的回退一致。
    const frameId = activeFrameId && document.entities[activeFrameId]
      ? activeFrameId
      : document.rootIds[0]
    if (!frameId || !document.entities[frameId]) return
    const next = fitViewportTo(
      getEntityWorldBounds(document, layoutSnapshot, frameId),
      surfaceSize,
    )
    // 求解宽高为 0 时不占用这次机会：下一次布局就绪还应该再试。
    if (!next) return
    autoFitDoneRef.current = true
    onViewportChange(next)
  }, [
    activeFrameId,
    autoFitActiveFrame,
    document,
    layoutSnapshot,
    onViewportChange,
    surfaceMeasured,
    surfaceSize,
  ])

  /**
   * 提交场景的新尺寸，并按新尺寸适配一次视口。
   *
   * @remarks
   * 适配用的矩形是「当前世界原点 + 刚提交的尺寸」，而不是重新读布局快照：命令刚派发，本帧的
   * `layoutSnapshot` 仍是旧尺寸，按它取景会先给用户一帧错误的缩放。改尺寸不会移动场景原点，
   * 因此原点直接沿用当前快照是准确的。
   */
  const changeSceneSize = (entityId: string, size: ComposeSize) => {
    const origin = getEntityWorldBounds(document, layoutSnapshot, entityId)
    const result = dispatch({
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.setFrameSize,
      payload: { entityId, size: { width: size.width, height: size.height } },
      meta: {
        label: messages.setSceneSize,
        source: 'stage',
        targetIds: [entityId],
      },
    })
    if (result.status === 'rejected') return
    fitViewport({ x: origin.x, y: origin.y, width: size.width, height: size.height })
  }

  // 宿主回灌给 Controller 的「本次绘制创建了谁」；Controller 按 entityId 去重。
  const [lastDrawn, setLastDrawn] = useState<StageDrawnEntity | null>(null)
  const contextMenu = useComposeContextMenu<string | null>()
  const resolvedShortcuts = useMemo(
    () => Object.fromEntries(STAGE_SHORTCUT_ACTIONS.map((action) => [
      action,
      shortcuts?.[action] ?? DEFAULT_STAGE_SHORTCUTS[action],
    ])) as unknown as Readonly<
      Record<ComposeStageShortcutAction, readonly ComposeStageKeybinding[]>
    >,
    [shortcuts],
  )
  const {
    previewDocument,
    previewLayoutSnapshot,
    sceneLayoutSnapshot,
  } = useStagePreviewDocuments({
    document,
    interactionPhase: interaction.phase,
    layoutPreviewSnapshot,
    layoutRuntime,
    layoutSnapshot,
    transforms: interaction.previewTransforms,
  })
  const normalizedSelection = useMemo(
    () => selectedIds.filter((id) => Boolean(document.entities[id])),
    [document, selectedIds],
  )
  const {
    beginContainerLabel,
    beginEntity,
    instanceSelectionBounds,
  } = useStageInstanceDrilldown({
    beginInteraction,
    document,
    layoutSnapshot,
    peekClickCount,
    selectedIds,
    surfaceRef,
    tool,
    viewport,
    onSelectedIdsChange,
  })

  const hiddenEntityIds = useStageHiddenEntityIds(document, normalizedSelection)

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
  const editableSelection = isStageSelectionEditable(document, normalizedSelection)
  const selectionConstraints = resolveStageSelectionConstraints(document, normalizedSelection)
  const {
    enabled: resizeHandles,
    visible: visibleResizeHandles,
  } = resolveStageResizeHandles(selectionConstraints)
  const selectionRotatable = isStageSelectionRotatable(selectionConstraints)
  const contextNodeId = contextMenu.payload
  const contextEditableIds = unlockedStageIds(document, normalizedSelection)



  const draftingMessages = useMemo(() => ({
    ready: messages.draftingReady,
    commandLineLabel: messages.draftingCommandLineLabel,
    commandPlaceholder: messages.draftingCommandPlaceholder,
    keywordsPrefix: messages.draftingKeywordsPrefix,
    unknownCommand: messages.draftingUnknownCommand,
    cancelled: messages.draftingCancelled,
    specifyFirstPoint: messages.draftingSpecifyFirstPoint,
    specifyNextPoint: messages.draftingSpecifyNextPoint,
    expectedPoint: messages.draftingExpectedPoint,
    drawCategory: messages.draftingDrawCategory,
    editCategory: messages.draftingEditCategory,
    lineTitle: messages.draftingLineTitle,
    wireTitle: messages.draftingWireTitle,
    arcTitle: messages.draftingArcTitle,
    circleTitle: messages.draftingCircleTitle,
    rectangleTitle: messages.draftingRectangleTitle,
    polylineTitle: messages.draftingPolylineTitle,
    specifyThroughPoint: messages.draftingSpecifyThroughPoint,
    specifyCenter: messages.draftingSpecifyCenter,
    specifyRadius: messages.draftingSpecifyRadius,
    specifyCorner: messages.draftingSpecifyCorner,
    specifyOppositeCorner: messages.draftingSpecifyOppositeCorner,
    undoKeyword: messages.draftingUndoKeyword,
    collinearArc: messages.draftingCollinearArc,
    degenerateShape: messages.draftingDegenerateShape,
    selectObjects: messages.draftingSelectObjects,
    expectedSelection: messages.draftingExpectedSelection,
    basePoint: messages.draftingBasePoint,
    displacementPoint: messages.draftingDisplacementPoint,
    moveTitle: messages.draftingMoveTitle,
    copyTitle: messages.draftingCopyTitle,
    eraseTitle: messages.draftingEraseTitle,
    vertexTitle: messages.draftingVertexTitle,
    specifyNewLocation: messages.draftingSpecifyNewLocation,
    expectedSingleObject: messages.draftingExpectedSingleObject,
    editGeometry: messages.editGeometry,
    orthoOn: messages.draftingOrthoOn,
    orthoOff: messages.draftingOrthoOff,
    snapOn: messages.draftingSnapOn,
    snapOff: messages.draftingSnapOff,
  }), [messages])

  // 命令与几何编辑共用一份场景索引：几何编辑要把正在编辑的 Entity 从捕捉里排除，而它又要读
  // 命令那条落点解算，两个 Hook 因此不能各自建索引，也不能互为前提。
  const sceneIndex = useMemo(
    () => createStageSceneIndex(document, layoutSnapshot),
    [document, layoutSnapshot],
  )
  // 取点效果在 effect dispatch 里被消费，而会话又依赖它——用 ref 打断这条循环，会话对象
  // 每帧重建也不会让 effect dispatch 的记忆化失效。几何编辑读落点解算走的也是这个 ref。
  const draftingRef = useRef<ReturnType<typeof useStageDrafting> | null>(null)
  const resolveDraftingPoint = useCallback(
    (world: StagePoint) => draftingRef.current?.resolvePoint(world) ?? { point: world },
    [],
  )

  /*
   * 绘图 Hook 排在几何编辑**之前**：点亮期的预览要读它解算后的落点，而读得晚一拍就等于让
   * 预览慢光标一帧。反方向的两处依赖（进入几何编辑、判断能不能几何编辑）改走 `geometryRef`，
   * 它们只在事件回调里调用，那时 ref 早已就位。
   */
  const geometryRef = useRef<StageGeometryEditing | null>(null)
  /**
   * 进入几何编辑会话，并用**触发它的那次指针事件**给十字光标播种。
   *
   * @remarks
   * 指针位置只在需要绘制时才跟踪，因此会话开始那一刻手上还没有本次跟踪期内的任何观测。
   * 不播种的话十字线会停在上一次跟踪留下的位置——那可能是上一条命令最后一次点击的地方，
   * 与用户刚刚双击的位置相差很远，直到他动一下鼠标才跳过来。
   *
   * 由非指针路径进入时（画完曲线的回灌、`VERTEX` 命令）缺席，此时不画，直到第一次
   * `pointermove`：浏览器不提供查询指针当前位置的接口，先不画是唯一诚实的答案。
   */
  const enterGeometryEditing = useCallback((entityId: string, worldPoint?: StagePoint) => {
    if (worldPoint) draftingRef.current?.setPointer(worldPoint)
    geometryRef.current?.enter(entityId)
  }, [])
  const isGeometryEditable = useCallback(
    (entityId: string) => geometryRef.current?.isGeometryEditable(entityId) ?? false,
    [],
  )

  // 夹点取点的会话住在绘图 Hook 里，而它又要读几何编辑的状态——同一条 ref 打断两个方向。
  const geometrySession = useMemo(() => ({
    start: (target: StageGripTarget) => { draftingRef.current?.startGripSession(target) },
    pick: (world: StagePoint) => { draftingRef.current?.handlePoint(world) },
    cancel: () => { draftingRef.current?.cancel() },
    clearNotice: () => { draftingRef.current?.clearNotice() },
  }), [])

  const draftingSession = useStageDrafting({
    // 绘图能力恒开：命令行常驻，命令随时可启动。模式已取消——它提供的四样没有一样
    // 需要模式承载，而模式本身与动画互斥、把同一件事拆成两套、并让能力不可发现。
    enabled: true,
    document,
    layoutSnapshot,
    viewport,
    registry,
    dispatch,
    idFactory,
    activeFrameId,
    index: sceneIndex,
    messages: draftingMessages,
    commands,
    selectedIds: normalizedSelection,
    onSelectedIdsChange,
    // `VERTEX` 是几何编辑的第二个入口，与双击产出同一个会话。
    onEnterGeometryEditing: enterGeometryEditing,
    isGeometryEditable,
  })
  const geometryEditing = useStageGeometryEditing({
    document,
    index: sceneIndex,
    session: geometrySession,
    armedGripId: draftingSession.gripTarget?.gripId ?? null,
    // 点亮期的预览钉在**解算后**的落点上，与十字线、橡皮筋终点和捕捉标记同一个值。
    resolvedPointer: draftingSession.resolvedPointer,
    selectedIds: normalizedSelection,
    tool,
    // 覆盖层至多渲染一条路径，宿主传入的优先：它是宿主明确要求画的，Stage 不该把它顶掉。
    hostPathActive: editablePath !== null,
    resolvePoint: resolveDraftingPoint,
  })
  const geometryEditingActive = geometryEditing.entityId !== null

  // 命令等着取点或等着选对象时才跟踪指针；两档合成一个标记，跟踪、挂载与推导读同一个。
  // 几何编辑期间也跟踪：这个模式的全部动作都是在取点，十字光标需要一个中心。
  const draftingPointerTracked = draftingSession.awaitingPoint || draftingSession.awaitingSelection
  const pointerTracked = draftingPointerTracked || geometryEditingActive

  /**
   * 十字光标的形态。
   *
   * @remarks
   * 判据是**当前等待的输入类型**：等待取点画线、等待选择对象画框、其余不画。几何编辑会话
   * 是「等着抓夹点」，因此未拖动时线与框都画，拖住之后框让位——那件事已经发生，框只会
   * 挡住落点。这与 AutoCAD 的 `Command:` / `Select objects:` / `Specify point:` 三态同构。
   *
   * **空闲什么都不画**是与 CAD 画布刻意的不对称——那边空闲时线与框都画（AutoCAD 惯例），
   * 而页面编辑器的静息光标是箭头。推导留在各自的包里，共享组件不认识这条差异。
   *
   * 「画不画」由 `resolveComposeCanvasCrosshair` 独家判定（含触摸豁免），隐藏系统光标读的是
   * 同一个返回值：两处各判一次必然出现「画了但没隐藏」——那正是本能力之前 Stage 的样子。
   */
  const crosshair = useMemo(() => resolveComposeCanvasCrosshair({
    show: showCrosshair,
    pointerType: draftingSession.pointerType,
    center: draftingSession.pointerScreen,
    lines: draftingSession.awaitingPoint || geometryEditingActive,
    // 点亮与拖动同样是「已经抓住了」，框只会挡住落点；两者共用 `gripTarget` 这一份事实。
    box: draftingSession.awaitingSelection
      || (geometryEditingActive && draftingSession.gripTarget === null),
    // 命令那一档用宿主配置的 `pickRadius`；顶点模式用夹点命中圆的内切正方形。两档的框含义
    // 不同，共用一个数会让顶点模式那个框慢慢说谎。
    boxRadius: draftingSession.awaitingSelection ? pickRadius : GRIP_PICK_RADIUS,
    size: crosshairSize,
  }), [
    crosshairSize,
    draftingSession.awaitingPoint,
    draftingSession.awaitingSelection,
    draftingSession.gripTarget,
    draftingSession.pointerScreen,
    draftingSession.pointerType,
    geometryEditingActive,
    pickRadius,
    showCrosshair,
  ])

  useLayoutEffect(() => {
    draftingRef.current = draftingSession
  })
  useLayoutEffect(() => {
    geometryRef.current = geometryEditing
  })

  const { assetDropStatus } = useStageEffectDispatch({
    activeFrameId,
    assetResolver,
    capturePointer,
    controller,
    dispatch,
    document,
    enterTextEditing,
    exitTextEditing,
    idFactory,
    layoutSnapshot,
    messages,
    registry,
    releasePointer,
    rootRef,
    surfaceRef,
    viewport,
    onDrawn: setLastDrawn,
    onDraftingPoint: (point) => { draftingRef.current?.handlePoint(point) },
    onToolChange,
    // 与 `VERTEX` 命令共用同一个入口：播种十字光标那一步因此不会只在其中一条路径上生效。
    onEnterGeometryEditing: enterGeometryEditing,
    // 几何编辑的夹点由 Stage 自己写文档；宿主传入的那条路径仍然只上报，事实来源在宿主。
    onEditablePathChange: (change) => {
      if (geometryRef.current?.handlePathChange(change) === true) return
      onEditablePathChange?.(change)
    },
    onEditablePathVertexToggle,
    onPaintSamplingComplete,
    onSelectedIdsChange,
    onViewportChange,
  })

  // 视口形状在这里适配：Stage 用 `{x,y,zoom}`，共享底座用 `{offset,zoom}`。两边都不必改自己
  // 的类型，适配只在这一个调用点。
  useCanvasWheelNavigation({
    containerRef: rootRef,
    surfaceRef,
    viewport: { offset: { x: viewport.x, y: viewport.y }, zoom: viewport.zoom },
    zoomRange: STAGE_ZOOM_RANGE,
    onViewportChange: (next) => {
      onViewportChange({ x: next.offset.x, y: next.offset.y, zoom: next.zoom })
    },
  })

  // 引擎只需要会话（entityId + 活动顶点），几何直接交给 Overlay。memo 保持引用稳定，
  // 避免每次渲染都触发 updateContext 的手势兼容性检查。
  const editablePathEntityId = editablePath?.entityId ?? geometryEditing.entityId
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
      // 绘图模式的框选按方向判定（左→右窗口、右→左交叉）：这是 AutoCAD 的惯例，也是宿主
      // 没有显式指定时该模式下最合理的默认，宿主显式给出的值仍然优先。
      // 判定模式只由宿主受控：模式不该偷改用户的设置。
      lockGestureParent,
      draftingAwaitingPoint: draftingSession.awaitingPoint,
      selectedIds: normalizedSelection,
      paintEditing,
      paintSampling,
      pathEditing,
      textEditing,
      drawnEntity: lastDrawn,
      contentReflowsWithWidth,
      isTextEditable,
      isGeometryEditable: geometryEditing.isGeometryEditable,
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
    draftingSession.awaitingPoint,
    hiddenEntityIds,
    geometryEditing.isGeometryEditable,
    isTextEditable,
    lastDrawn,
    layoutSnapshot,
    idFactory,
    messages.createGuide,
    messages.createGuides,
    messages.deleteGuide,
    messages.moveGuide,
    lockGestureParent,
    normalizedSelection,
    paintEditing,
    paintSampling,
    pathEditing,
    surfaceSize,
    textEditing,
    tool,
    viewport,
  ])

  /**
   * 单选一条曲线时的世界坐标轮廓；其余情形为 `null`。
   *
   * @remarks
   * 判据是**盒是不是这个对象的轮廓**：矩形、图片、容器的盒就是它们的轮廓，文字占满自己的盒，
   * 而一条对角线的包围盒里绝大部分是空的——那个矩形宣称了对象并不占据的面积，线越接近 45 度
   * 它越大。这不是给曲线开特例，是同一句话在不同形状上给出不同答案。
   *
   * 只在 `select` 下派生：`scale` 与 `rotate` 是**盒操作**，那时盒就是用户正在操作的东西。
   * 多选也不派生——多选框回答的是「这一堆的范围」，不宣称任何单个对象的轮廓。
   *
   * 与几何编辑会话画的是**同一条**（`stageCurveOutline`），不另写一份：两份实现的分叉症状是
   * 「双击前后线的轮廓差半个像素」，而那种偏移只在特定缩放下现形。
   */
  const selectionOutline = useMemo(() => {
    if (tool !== 'select' || normalizedSelection.length !== 1) return null
    const entityId = normalizedSelection[0]!
    const entity = document.entities[entityId]
    if (!entity || !getComposeCurve(entity)) return null
    const outline = stageCurveOutline(document, sceneIndex, entityId)
    return outline.length > 1 ? outline : null
  }, [document, normalizedSelection, sceneIndex, tool])

  useFinalControllerDisposal(privateController)

  const {
    canvasGuides,
    frameBounds,
    handlePoints,
    horizontalTicks,
    marqueeScreen,
    screenBounds,
    scrollAxes,
    verticalTicks,
    worldOriginScreen,
  } = resolveStageScreenModel({
    activeFrameId,
    document,
    guidePreview,
    hiddenEntityIds,
    layoutSnapshot,
    marquee,
    previewDocument,
    previewLayoutSnapshot,
    scrollRange: interaction.scrollRange,
    selectedIds,
    selectionBounds: bounds,
    surfaceSize,
    viewport,
  })

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
  useLayoutEffect(() => {
    stopTemporaryPanRef.current = stopTemporaryPan
  }, [stopTemporaryPan])

  // 失焦要同时结束临时平移与取消指针会话，两者必须留在同一个监听器里：拆成两个 blur
  // 监听器，其相对顺序就变成了 effect 注册顺序的副产品。
  useEffect(() => {
    const handleBlur = () => {
      stopTemporaryPan()
      cancelGesture()
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [cancelGesture, stopTemporaryPan])

  /**
   * 十字光标的指针跟踪。
   *
   * @remarks
   * 挂在**根元素**上（见 `useStageRootHandlers` 的 `trackPointer`），因此拖动期间十字线不断。
   *
   * 拖动中指针可以合法地移出图面——甩到边界外再拉回来是常见操作，此时仍要跟。既不在拖动、
   * 又不在图面上，说明指针去了命令行或标尺，那里不该有十字光标。判据用事件自带的
   * `buttons`，不必再引一个「手势是否在跑」的外部状态。
   */
  const trackPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current
    if (!surface) return
    const rect = surface.getBoundingClientRect()
    const local = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const inside = local.x >= 0 && local.y >= 0 && local.x <= rect.width && local.y <= rect.height
    if (!inside && event.buttons === 0) {
      draftingSession.setPointer(null)
      return
    }
    draftingSession.setPointer(screenToWorld(local, viewport), event.pointerType)
  }, [draftingSession, viewport])
  const clearPointer = useCallback(() => { draftingSession.setPointer(null) }, [draftingSession])

  /**
   * 跟踪停止时清掉已记录的指针位置。
   *
   * @remarks
   * 与进入时的播种是**一对**，缺一不可。只清不播种：双击进入几何编辑后十字线要等用户动一下
   * 鼠标才出现，而那一下双击本来就带着坐标。只播种不清：漏掉任何一条进入路径就又画在旧位置
   * 上，而这个缺陷只在跑过一次会话之后才出现，最容易活下来。
   *
   * 两件一起做之后，不变量收成一句：**十字光标只画在本次跟踪开始之后观测到的位置上。**
   */
  const setDraftingPointer = draftingSession.setPointer
  useEffect(() => {
    if (!pointerTracked) setDraftingPointer(null)
  }, [pointerTracked, setDraftingPointer])

  const rootHandlers = useStageRootHandlers({
    clearPointer,
    trackPointer: pointerTracked ? trackPointer : null,
    beginInteraction,
    handleLostPointerCapture,
    keyboardRelease,
    normalizedSelection,
    openContextMenu: contextMenu.openAt,
    rootRef,
    rulersRef,
    surfaceRef,
    onSelectedIdsChange,
    keyboardCommand: (event) => {
      // 绘图的 F8/F3 先于既有键位级联：它们在别处没有绑定，因此不会抢走任何东西。
      // Esc 只在命令进行中被这里消费，其余情况交回级联——文字编辑的退出分支在那里。
      if (draftingRef.current?.handleKeyDown(event)) return
      // 几何编辑的退出排在命令之后、既有级联之前：命令进行中的 Esc 属于命令，而级联里的
      // Esc 会去中止手势并清空选区——那会顺带把会话的目标一起收走，用户看不出是哪一条生效。
      if (event.key === 'Escape' && geometryRef.current?.entityId != null) {
        geometryRef.current.exit()
        return
      }
      keyboardCommand(event)
    },
    host: {
      onContextMenu: props.onContextMenu,
      onLostPointerCapture,
      onPointerCancel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onWheel,
    },
  })

  return (
    <div
      {...props}
      aria-label={props['aria-label'] ?? 'Stage'}
      className={['compose-stage', className].filter(Boolean).join(' ')}
      data-compose-theme={theme?.resolvedTheme}
      data-crosshair={crosshair ? '' : undefined}
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
      {...rootHandlers}
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
      <ComposeCanvasRulers
        testIdPrefix="stage-ruler"
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
        <StageWorldUnderlay frameBounds={frameBounds} worldOriginScreen={worldOriginScreen} />
        <StageSceneLayer
          assetResolver={assetResolver}
          document={previewDocument}
          hiddenEntityIds={hiddenEntityIds}
          layoutSnapshot={sceneLayoutSnapshot}
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
          sceneSizeLabel={messages.sceneSize}
          onLabelPointerDown={beginContainerLabel}
          onRename={onEntityRename}
          onSceneActivate={onSceneActivate}
          onScenePreview={onScenePreview}
          onSceneSizeChange={changeSceneSize}
        />
        {assetDropStatus
          ? (
              <div className="compose-stage__asset-drop-status" role="status">
                {assetDropStatus}
              </div>
            )
          : null}
        {/*
          * 十字光标与取点预览跟随**当前等待的输入类型**，不跟随任何全局模式：没有命令在跑时
          * 图面是常规光标，命令一开始等输入就换成十字光标。挂载条件放宽到「有东西要画」——
          * 只看等待取点的话，等待选择对象那一档的拾取框挂不上。
          */}
        {pointerTracked ? (
          <StageDraftingOverlay
            crosshair={crosshair}
            outlines={draftingSession.outlines}
            rubberBand={draftingSession.rubberBand}
            snap={draftingSession.snap}
            surfaceSize={surfaceSize}
            viewport={viewport}
          />
        ) : null}
        <StageOverlay
          canvasGuides={canvasGuides}
          drawing={interaction.drawing}
          dropIndicator={dropIndicator}
          editableSelection={editableSelection}
          handlePoints={handlePoints}
          label={messages.editingOverlay}
          marqueeHitTest={interaction.marqueeHitTest}
          marqueeScreen={marqueeScreen}
          paintHandles={interaction.paintHandles}
          paintSample={interaction.paintSample}
          editablePath={editablePath ?? geometryEditing.editablePath}
          geometryEditing={geometryEditingActive}
          activePathVertexId={editablePathActiveVertexId}
          hotPathVertexId={geometryEditing.dragging ? null : draftingSession.gripTarget?.gripId ?? null}
          resizeHandles={resizeHandles}
          rotatable={selectionRotatable}
          rotationPreview={interaction.rotationPreview}
          instanceSelectionBounds={instanceSelectionBounds}
          screenBounds={screenBounds}
          selectionOutline={selectionOutline}
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
      {/* 命令行常驻：不进模式就看不见命令行，正是「能力不可发现」那条毛病。 */}
      <ComposeCommandLine
        className="compose-stage__command-line"
        messages={{
          ready: messages.draftingReady,
          inputLabel: messages.draftingCommandLineLabel,
          placeholder: messages.draftingCommandPlaceholder,
          keywordsPrefix: messages.draftingKeywordsPrefix,
        }}
        notice={draftingSession.notice}
        prompt={draftingSession.prompt}
        status={[
          ...(draftingSession.selectionCount === null
            ? []
            : [{
                id: 'selection-count',
                label: messages.draftingSelectionCount(draftingSession.selectionCount),
                active: draftingSession.selectionCount > 0,
              }]),
          {
            id: 'snap-state',
            label: draftingSession.snapEnabled ? messages.draftingSnapOn : messages.draftingSnapOff,
            active: draftingSession.snapEnabled,
          },
          {
            id: 'ortho-state',
            label: draftingSession.ortho ? messages.draftingOrthoOn : messages.draftingOrthoOff,
            active: draftingSession.ortho,
          },
        ]}
        testIdPrefix="stage-drafting"
        onCancel={draftingSession.cancel}
        onSubmit={draftingSession.submit}
      />
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
        viewport={viewport}
        onClipboardAction={executeClipboard}
        onCreateComponentIntent={onCreateComponentIntent}
        onSceneActivate={onSceneActivate}
        onSelectedIdsChange={onSelectedIdsChange}
        onViewportChange={onViewportChange}
      />
    </div>
  )
}
