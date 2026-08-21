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
import {
} from '@compose-ui/component-registry'
import type {
  ComposeRendererMeasurementAdapter,
} from '@compose-ui/component-registry'
import {
  collectComposeSwitcherHiddenIds,
  getComposeVisibility,
  resolveComposeSwitcherPreview,
  type ComposeLayoutSnapshot,
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
  getEntityWorldBounds,
  unionRects,
  worldToScreen,
  type StageDrawnEntity,
} from '@compose-ui/stage-engine'
import type {
  ComposeStageKeybinding,
  ComposeStageShortcutAction,
  ComposeStagePolicy,
  ComposeStageProps,
} from '../types'
import { StageScrollbar } from '../scrollbar'
import { StageOverlay } from '../stage-overlay'
import {
} from './stage-pointer-geometry'
import {
  bootstrapSelectionBounds,
  lineSegmentForEntity,
  lineSegmentTransform,
  type StageTransformMap,
} from './stage-preview-document'
import {
  DEFAULT_STAGE_SHORTCUTS,
  STAGE_SHORTCUT_ACTIONS,
} from './stage-shortcuts'
import {
  frameScreenBounds,
  mergeCanvasGuides,
  resizeHandlePoints,
  visibleWorldRect,
  worldRectToScreen,
} from './stage-screen-geometry'
import {
  isStageSelectionEditable,
  isStageSelectionRotatable,
  resolveStageResizeHandles,
  resolveStageSelectionConstraints,
  unlockedStageIds,
} from './stage-selection-derivations'
import { useStageInstanceDrilldown } from './use-stage-instance-drilldown'
import { useStagePreviewDocuments } from './use-stage-preview-documents'
import { useComposeStageMeasurement, useFinalControllerDisposal } from './stage-lifecycle'
import { useStageRootHandlers } from './use-stage-root-handlers'
import { StageWorldUnderlay } from './stage-world-underlay'
import { StageContextMenu } from './stage-context-menu'
import { useStageEffectDispatch } from './use-stage-effect-dispatch'
import { useStagePointerSession } from './use-stage-pointer-session'
import { useStageWheelNavigation } from './use-stage-wheel-navigation'
import { useStageTextEditing } from './use-stage-text-editing'
import { useStageClipboard } from './use-stage-clipboard'
import { useStageKeyboardCommands } from './use-stage-keyboard'
import { StageRulers, type StageRulersHandle } from '../stage-ruler'
import { StageSceneLayer } from '../stage-scene-layer'
import {
} from '@compose-ui/stage-engine'
import { getStageMessages } from '../stage-i18n'
import { createVisualGridStyle } from '../grid-rendering'
import { ComposeContainerLabelLayer } from '../container-label-layer'
import {
  type ShapeDirection,
} from './drawing-entity'


function defaultId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `stage-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** 宿主省略 policy 时的解构底座；共用常量避免每帧分配一个空对象。 */
const EMPTY_STAGE_POLICY: ComposeStagePolicy = Object.freeze({})


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
    previewDirections,
    previewTransforms,
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
  const editableSelection = isStageSelectionEditable(document, normalizedSelection)
  const selectionConstraints = resolveStageSelectionConstraints(document, normalizedSelection)
  const {
    enabled: resizeHandles,
    visible: visibleResizeHandles,
  } = resolveStageResizeHandles(selectionConstraints)
  const selectionRotatable = isStageSelectionRotatable(selectionConstraints)
  const contextNodeId = contextMenu.payload
  const contextEditableIds = unlockedStageIds(document, normalizedSelection)

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

  useStageWheelNavigation({ rootRef, surfaceRef, viewport, onViewportChange })

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

  const screenBounds = worldRectToScreen(bounds, viewport)
  const boundarySceneIndex = createStageSceneIndex(document, layoutSnapshot, hiddenEntityIds)
  const frameBounds = frameScreenBounds(document, boundarySceneIndex, viewport)
  const worldOriginScreen = worldToScreen({ x: 0, y: 0 }, viewport)
  const marqueeScreen = worldRectToScreen(marquee, viewport)
  const handlePoints = resizeHandlePoints(screenBounds)
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
  // 辅助线保存在活动 Frame 的局部坐标里；Overlay 在世界坐标绘制，因此这里映射一次。
  const targetFrameId = resolveTargetFrameId(document, selectedIds, activeFrameId)
  const canvasGuides = mergeCanvasGuides(
    listFrameWorldGuides(document, targetFrameId, boundarySceneIndex)
      .map((guide) => ({ id: guide.id, axis: guide.axis, position: guide.value })),
    guidePreview,
  )
  const visibleWorld = visibleWorldRect(viewport, surfaceSize)
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
        <StageWorldUnderlay frameBounds={frameBounds} worldOriginScreen={worldOriginScreen} />
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
