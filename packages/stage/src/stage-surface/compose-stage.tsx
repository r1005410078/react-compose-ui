import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import {
  useComposeContextMenu,
} from '@compose-ui/components'
import {
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
} from 'react'
import type {
  ComposeRendererMeasurementAdapter,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  type ComposeLayoutSnapshot,
  type ComposeSize,
} from '@compose-ui/core'
import {
  createStageInteractionController,
  createStageSceneIndex,
  getEntityWorldBounds,
  resolveStageDropIndicator,
  scrollAxisToViewport,
  STAGE_ZOOM_RANGE,
  type StageDrawnEntity,
  type StageRect,
} from '@compose-ui/stage-engine'
import { fitViewportTo } from './stage-viewport-actions'
import type {
  ComposeStageKeybinding,
  ComposeStageShortcutAction,
  ComposeStagePolicy,
  ComposeStageProps,
} from '../types'
import { StageScrollbar } from '../scrollbar'
import { StageOverlay } from '../stage-overlay'
import {
  bootstrapSelectionBounds,
  lineSegmentForEntity,
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
import { useStagePointerSession, useStageRootHandlers } from './pointer-session'
import { useStageTextEditing } from './use-stage-text-editing'
import { useStageClipboard } from './use-stage-clipboard'
import {
  ComposeCanvasRulers,
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
    segmentPreview: interaction.segmentPreview,
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
  const editableSelection = isStageSelectionEditable(document, normalizedSelection)
  const selectionConstraints = resolveStageSelectionConstraints(document, normalizedSelection)
  const {
    enabled: resizeHandles,
    visible: visibleResizeHandles,
  } = resolveStageResizeHandles(selectionConstraints)
  const selectionRotatable = isStageSelectionRotatable(selectionConstraints)
  const contextNodeId = contextMenu.payload
  const contextEditableIds = unlockedStageIds(document, normalizedSelection)



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
    onToolChange,
    onEditablePathChange,
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

  const rootHandlers = useStageRootHandlers({
    beginInteraction,
    handleLostPointerCapture,
    keyboardCommand,
    keyboardRelease,
    normalizedSelection,
    openContextMenu: contextMenu.openAt,
    rootRef,
    rulersRef,
    surfaceRef,
    onSelectedIdsChange,
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
