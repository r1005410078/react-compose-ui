import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
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
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'
import type {
  ComposeDocument,
  ComposeFrameNode,
  ComposeNode,
  JsonValue,
  NodeTransform,
} from '@compose-ui/core'
import {
  createRulerTicks,
  createStageInteractionController,
  expandScrollRange,
  scrollAxisToViewport,
  viewportToScrollAxes,
  createDuplicateCommand,
  createGroupCommand,
  createUngroupCommand,
  applyMatrix,
  getNodeWorldBounds,
  getNodeWorldMatrix,
  invertMatrix,
  screenToWorld,
  unionRects,
  worldToScreen,
  zoomViewportAt,
  type ResizeHandle,
  type StagePoint,
  type StageRect,
  type StageInteractionEffect,
  type StageInteractionHit,
  type StageInteractionController,
} from '@compose-ui/stage-engine'
import type {
  StageKeybinding,
  StageShortcutAction,
  StageProps,
} from './types'
import { StageScrollbar } from './scrollbar'
import { StageOverlay } from './stage-overlay'
import { StageRulers } from './stage-rulers'
import { StageSceneLayer } from './stage-scene-layer'
import {
  describeNodeCreation,
  describeNodeTargets,
  describeTransform,
} from '@compose-ui/stage-engine'
import { getStageMessages } from './stage-i18n'

type TransformMap = Readonly<Record<string, NodeTransform>>
type Modifiers = { shift: boolean; alt: boolean; command: boolean }
type PointerSessionStatus = 'active' | 'finishing' | 'ended'

interface FrozenSurfaceRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

interface ActivePointerSession {
  readonly pointerId: number
  readonly generation: number
  readonly surfaceRect: FrozenSurfaceRect
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

function stageElementRect(
  element: HTMLElement,
): DOMRect {
  let rect = element.getBoundingClientRect()
  if (
    rect.width === 0
    && rect.height === 0
    && element.classList.contains('compose-stage__surface')
    && element.parentElement
  ) {
    // JSDOM 不做布局；组件测试仍可通过根元素的显式 rect 验证坐标算法。
    rect = element.parentElement.getBoundingClientRect()
  }
  return rect
}

function screenPoint(
  event: { clientX: number; clientY: number },
  element: HTMLElement,
): StagePoint {
  const rect = stageElementRect(element)
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function frozenSurfaceRect(element: HTMLElement): FrozenSurfaceRect {
  const rect = stageElementRect(element)
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

function screenPointFromRect(
  event: { clientX: number; clientY: number },
  rect: FrozenSurfaceRect,
): StagePoint {
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function pressedButtons(button: number, buttons: number) {
  if (buttons !== 0) return buttons
  if (button === 0) return 1
  if (button === 1) return 4
  if (button === 2) return 2
  return 0
}

function resolveClientPoint(
  point: StagePoint,
  element: HTMLElement,
): StagePoint | null {
  const rect = stageElementRect(element)
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null
  return { x: point.x - rect.left, y: point.y - rect.top }
}

function modifiers(event: {
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}): Modifiers {
  return {
    shift: event.shiftKey,
    alt: event.altKey,
    command: event.ctrlKey || event.metaKey,
  }
}

function transformDocument(document: ComposeDocument, transforms: TransformMap): ComposeDocument {
  if (Object.keys(transforms).length === 0) return document
  const nodes = { ...document.nodes }
  for (const [id, transform] of Object.entries(transforms)) {
    const node = nodes[id]
    if (node) nodes[id] = { ...node, transform } as ComposeNode
  }
  return { ...document, nodes }
}

function bootstrapSelectionBounds(
  document: ComposeDocument,
  ids: readonly string[],
) {
  return unionRects(ids
    .filter((id) => Boolean(document.nodes[id]?.visible))
    .map((id) => getNodeWorldBounds(document, id)))
}

function visualGridStyle(
  document: ComposeDocument,
  viewport: StageProps['viewport'],
): CSSProperties {
  const { grid } = document.canvas
  const layers: string[] = []
  const sizes: string[] = []
  const positions: string[] = []
  const addVertical = (step: number, color: string) => {
    layers.push(`linear-gradient(90deg, ${color} 1px, transparent 1px)`)
    sizes.push(`${step * viewport.zoom}px 100%`)
    positions.push(`${grid.offsetX * viewport.zoom + viewport.x}px 0`)
  }
  const addHorizontal = (step: number, color: string) => {
    layers.push(`linear-gradient(${color} 1px, transparent 1px)`)
    sizes.push(`100% ${step * viewport.zoom}px`)
    positions.push(`0 ${grid.offsetY * viewport.zoom + viewport.y}px`)
  }
  const minorColor = 'var(--compose-stage-grid-minor, rgb(120 137 158 / 18%))'
  const primaryColor = 'var(--compose-stage-grid-primary, rgb(151 166 185 / 34%))'
  if (grid.stepX * viewport.zoom >= 8) addVertical(grid.stepX, minorColor)
  if (grid.stepY * viewport.zoom >= 8) addHorizontal(grid.stepY, minorColor)
  let primaryX = grid.stepX * grid.primaryLineEvery
  let primaryY = grid.stepY * grid.primaryLineEvery
  while (primaryX * viewport.zoom < 8) primaryX *= 2
  while (primaryY * viewport.zoom < 8) primaryY *= 2
  addVertical(primaryX, primaryColor)
  addHorizontal(primaryY, primaryColor)
  return {
    backgroundImage: layers.join(','),
    backgroundSize: sizes.join(','),
    backgroundPosition: positions.join(','),
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select')) return true
  if (target instanceof HTMLElement && target.contentEditable === 'true') return true
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null
}

const STAGE_SHORTCUT_ACTIONS = [
  'stage.temporaryPan',
  'stage.selectTool',
  'stage.panTool',
  'stage.fitSelection',
  'stage.fitFrame',
  'stage.zoomReset',
  'stage.zoomIn',
  'stage.zoomOut',
  'stage.toggleGridSnap',
  'stage.toggleSmartSnap',
  'edit.duplicate',
  'edit.group',
  'edit.ungroup',
  'edit.delete',
] as const satisfies readonly StageShortcutAction[]

const DEFAULT_STAGE_SHORTCUTS: Readonly<
  Record<StageShortcutAction, readonly StageKeybinding[]>
> = {
  'stage.temporaryPan': [{ code: 'Space' }],
  'stage.selectTool': [{ code: 'KeyV' }],
  'stage.panTool': [{ code: 'KeyH' }],
  'stage.fitSelection': [{ code: 'KeyF' }],
  'stage.fitFrame': [{ code: 'KeyF', shift: true }],
  'stage.zoomReset': [{ code: 'Digit0', primary: true }],
  'stage.zoomIn': [{ code: 'Equal', primary: true }],
  'stage.zoomOut': [{ code: 'Minus', primary: true }],
  'stage.toggleGridSnap': [{ code: 'KeyG', shift: true }],
  'stage.toggleSmartSnap': [{ code: 'KeyS', shift: true }],
  'edit.duplicate': [{ code: 'KeyD', primary: true }],
  'edit.group': [{ code: 'KeyG', primary: true }],
  'edit.ungroup': [{ code: 'KeyG', primary: true, shift: true }],
  'edit.delete': [{ code: 'Delete' }, { code: 'Backspace' }],
}

function keyboardEventCode(event: {
  code: string
  key: string
}) {
  if (event.code) return event.code
  if (/^[a-z]$/i.test(event.key)) return `Key${event.key.toUpperCase()}`
  if (/^[0-9]$/.test(event.key)) return `Digit${event.key}`
  const codes: Record<string, string> = {
    ' ': 'Space',
    ',': 'Comma',
    '=': 'Equal',
    '-': 'Minus',
  }
  return codes[event.key] ?? event.key
}

function isStageShortcutMatch(
  event: {
    altKey: boolean
    code: string
    ctrlKey: boolean
    key: string
    metaKey: boolean
    shiftKey: boolean
  },
  binding: StageKeybinding,
) {
  const modifierMatches = binding.primary
    ? event.ctrlKey !== event.metaKey
    : event.ctrlKey === Boolean(binding.control) && !event.metaKey
  return keyboardEventCode(event) === binding.code
    && modifierMatches
    && event.shiftKey === Boolean(binding.shift)
    && event.altKey === Boolean(binding.alt)
}

/**
 * 渲染受控 DOM/SVG 无限 Stage。
 *
 * @public
 */
export function Stage({
  document,
  registry,
  dispatch,
  viewport,
  onViewportChange,
  tool,
  onToolChange,
  locale,
  shortcuts,
  selectedIds,
  onSelectedIdsChange,
  activeFrameId,
  onActiveFrameIdChange,
  onSurfaceSizeChange,
  interactionController,
  framePresets = [],
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
}: StageProps) {
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const resolvedLocale = locale ?? i18n?.locale ?? 'zh-CN'
  const messages = getStageMessages(resolvedLocale, i18n?.formatMessage)
  const generatedSurfaceId = useId()
  const surfaceId = id ? `${id}-surface` : generatedSurfaceId
  const rootRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const activePointerSessionRef = useRef<ActivePointerSession | null>(null)
  const pointerGenerationRef = useRef(0)
  const pendingPointerStartRef = useRef<{
    readonly pointerId: number
    readonly buttons: number
    readonly surfaceRect: FrozenSurfaceRect
  } | null>(null)
  const pendingRef = useRef<PendingPointerSample | null>(null)
  const frameRequestRef = useRef<number | null>(null)
  const pointerRouteCleanupRef = useRef<(() => void) | null>(null)
  const expectedLostCaptureRef = useRef(new Map<number, number[]>())
  const [privateController] = useState(createStageInteractionController)
  const controller = interactionController ?? privateController
  const interaction = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  const previewTransforms = interaction.previewTransforms
  const marquee = interaction.marquee
  const snapGuides = interaction.snapGuides
  const guidePreview = interaction.guidePreview
  const [surfaceSize, setSurfaceSize] = useState({ width: 900, height: 600 })
  const activeTemporaryPanCodeRef = useRef<string | null>(null)
  const resolvedShortcuts = useMemo(
    () => Object.fromEntries(STAGE_SHORTCUT_ACTIONS.map((action) => [
      action,
      shortcuts?.[action] ?? DEFAULT_STAGE_SHORTCUTS[action],
    ])) as unknown as Readonly<
      Record<StageShortcutAction, readonly StageKeybinding[]>
    >,
    [shortcuts],
  )
  const previewDocument = useMemo(
    () => transformDocument(document, previewTransforms),
    [document, previewTransforms],
  )
  const normalizedSelection = useMemo(
    () => selectedIds.filter((id) => Boolean(document.nodes[id])),
    [document, selectedIds],
  )
  // 首帧可能先于 effect 中的 context 注入；之后（含 gesture preview）以 engine snapshot 为准。
  const bounds = interaction.selectionBounds
    ?? bootstrapSelectionBounds(previewDocument, normalizedSelection)
  const editableSelection = normalizedSelection.length > 0
    && normalizedSelection.every((id) => {
      const node = document.nodes[id]
      return node?.visible && !node.locked
    })
  const latestRef = useRef({
    document,
    registry,
    dispatch,
    viewport,
    onViewportChange,
    onSelectedIdsChange,
    onActiveFrameIdChange,
    framePresets,
    idFactory,
  })
  useLayoutEffect(() => {
    latestRef.current = {
      document,
      registry,
      dispatch,
      viewport,
      onViewportChange,
      onSelectedIdsChange,
      onActiveFrameIdChange,
      framePresets,
      idFactory,
    }
  })

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
    pendingRef.current = {
      pointerId: session.pointerId,
      generation: session.generation,
      point: screenPointFromRect(event, session.surfaceRect),
      modifiers: modifiers(event),
    }
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
    controller.send({
      type: 'pointer.up',
      pointerId: session.pointerId,
      point: screenPointFromRect(event, session.surfaceRect),
      modifiers: modifiers(event),
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
    // capture phase 先于 React 根节点回调，避免宿主 stopPropagation 使内部路由漏掉最终点。
    window.addEventListener('pointermove', handleMove, true)
    window.addEventListener('pointerup', handleUp, true)
    window.addEventListener('pointercancel', handleCancel, true)
    pointerRouteCleanupRef.current = () => {
      window.removeEventListener('pointermove', handleMove, true)
      window.removeEventListener('pointerup', handleUp, true)
      window.removeEventListener('pointercancel', handleCancel, true)
    }
  }, [
    cancelPointerSession,
    finishPointerSession,
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
        if (effect.type === 'active-frame.change') {
          current.onActiveFrameIdChange(effect.frameId)
          return
        }
        if (effect.type === 'command.dispatch') {
          current.dispatch(effect.command)
          return
        }
        const nodeId = current.idFactory()
        if (effect.item.kind === 'component') {
          const seed = current.registry.createSeed(effect.item.componentType)
          if (!seed.ok) return
          const frame = effect.frameId
            ? current.document.nodes[effect.frameId]
            : undefined
          const localCenter = frame?.kind === 'frame'
            ? applyMatrix(
                invertMatrix(getNodeWorldMatrix(current.document, frame.id)),
                effect.worldPoint,
              )
            : effect.worldPoint
          const node = {
            id: nodeId,
            kind: 'component' as const,
            name: seed.seed.name,
            visible: true,
            locked: false,
            transform: {
              x: localCenter.x - seed.seed.width / 2,
              y: localCenter.y - seed.seed.height / 2,
              width: seed.seed.width,
              height: seed.seed.height,
              rotation: 0,
            },
            componentType: effect.item.componentType,
            props: seed.seed.props,
            ...(seed.seed.style ? { style: seed.seed.style } : {}),
          }
          const result = current.dispatch({
            id: current.idFactory(),
            type: 'node.create',
            payload: {
              node: node as unknown as JsonValue,
              parentId: frame?.kind === 'frame' ? frame.id : null,
            },
            meta: {
              label: frame
                ? describeNodeCreation(node)
                : `Reject ${node.name} outside a Frame`,
              source: 'component-palette',
              targetIds: [nodeId],
            },
          })
          if (result.status === 'committed' && frame?.kind === 'frame') {
            current.onSelectedIdsChange([nodeId])
            current.onActiveFrameIdChange(frame.id)
          }
          return
        }
        const frameItem = effect.item
        const preset = current.framePresets.find(
          (candidate) => candidate.id === frameItem.presetId,
        )
        let frameStyle: ComposeFrameNode['style']
        let validPreset = Boolean(preset)
        try {
          frameStyle = preset?.createDefaultStyle()
        }
        catch {
          validPreset = false
        }
        const size = preset?.defaultSize ?? { width: 0, height: 1 }
        const node: ComposeFrameNode = {
          id: nodeId,
          kind: 'frame',
          name: preset?.name ?? frameItem.presetId,
          visible: true,
          locked: false,
          transform: {
            x: effect.worldPoint.x - size.width / 2,
            y: effect.worldPoint.y - size.height / 2,
            width: validPreset ? size.width : 0,
            height: size.height,
            rotation: 0,
          },
          style: frameStyle,
          childIds: [],
        }
        const result = current.dispatch({
          id: current.idFactory(),
          type: 'frame.create',
          payload: {
            node: node as unknown as JsonValue,
            index: current.document.rootIds.length,
          },
          meta: {
            label: describeNodeCreation(node),
            source: 'component-palette',
            targetIds: [nodeId],
          },
        })
        if (result.status === 'committed') {
          current.onSelectedIdsChange([nodeId])
          current.onActiveFrameIdChange(nodeId)
        }
      })
    },
  }), [capturePointer, controller, releasePointer])

  useLayoutEffect(() => {
    controller.updateContext({
      document,
      viewport,
      surfaceSize,
      tool,
      selectedIds: normalizedSelection,
      activeFrameId,
      idFactory,
      labels: {
        createGuide: messages.createGuide,
        createGuides: messages.createGuides,
        moveGuide: messages.moveGuide,
        deleteGuide: messages.deleteGuide,
      },
    })
  }, [
    activeFrameId,
    controller,
    document,
    idFactory,
    messages.createGuide,
    messages.createGuides,
    messages.deleteGuide,
    messages.moveGuide,
    normalizedSelection,
    surfaceSize,
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

  useEffect(() => {
    const stopTemporaryPan = () => {
      activeTemporaryPanCodeRef.current = null
      controller.send({ type: 'temporary-pan.end' })
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (activeTemporaryPanCodeRef.current === keyboardEventCode(event)) {
        stopTemporaryPan()
      }
    }
    const handleBlur = () => {
      stopTemporaryPan()
      const session = activePointerSessionRef.current
      if (session) cancelPointerSession(session)
      else controller.send({ type: 'pointer.cancel' })
    }
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [cancelPointerSession, controller])

  const beginInteraction = (
    hit: StageInteractionHit,
    event: ReactPointerEvent<Element>,
  ) => {
    const surface = surfaceRef.current
    if (!surface || activePointerSessionRef.current) return
    const start = {
      pointerId: event.pointerId,
      buttons: pressedButtons(event.button, event.buttons),
      surfaceRect: frozenSurfaceRect(surface),
    }
    pendingPointerStartRef.current = start
    try {
      controller.send({
        type: 'pointer.down',
        pointerId: event.pointerId,
        button: event.button,
        point: screenPointFromRect(event, start.surfaceRect),
        hit,
        modifiers: modifiers(event),
      })
    }
    finally {
      if (pendingPointerStartRef.current === start) {
        pendingPointerStartRef.current = null
      }
    }
  }

  const beginNode = (node: ComposeNode, event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    beginInteraction({ kind: 'node', nodeId: node.id }, event)
  }

  const screenBounds = bounds
    ? {
        ...worldToScreen(bounds, viewport),
        width: bounds.width * viewport.zoom,
        height: bounds.height * viewport.zoom,
      }
    : null
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
  const canvasGuides = [
    ...document.canvas.guides.map((guide) => previewById.get(guide.id) ?? guide),
    ...guidePreview.filter((guide) => !document.canvas.guides.some(({ id }) => id === guide.id)),
  ]
  const visibleWidth = surfaceSize.width / viewport.zoom
  const visibleHeight = surfaceSize.height / viewport.zoom
  const visibleWorld = {
    ...screenToWorld({ x: 0, y: 0 }, viewport),
    width: visibleWidth,
    height: visibleHeight,
  }
  const bootstrapContentBounds = unionRects(Object.values(previewDocument.nodes)
    .filter((node) => node.visible)
    .map((node) => getNodeWorldBounds(previewDocument, node.id)))
  const activeScrollRange = interaction.scrollRange
    ?? expandScrollRange(null, bootstrapContentBounds, visibleWorld)
  const scrollAxes = viewportToScrollAxes(viewport, surfaceSize, activeScrollRange)

  const keyboardCommand = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || event.nativeEvent.isComposing || isEditableTarget(event.target)) return
    const actionMatches = (action: StageShortcutAction) =>
      resolvedShortcuts[action].some((binding) =>
        isStageShortcutMatch(event.nativeEvent, binding))
    if (actionMatches('stage.temporaryPan')) {
      activeTemporaryPanCodeRef.current = keyboardEventCode(event.nativeEvent)
      controller.send({ type: 'temporary-pan.start' })
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') {
      cancelGesture()
      return
    }
    if (actionMatches('stage.selectTool')) {
      onToolChange?.('select')
      event.preventDefault()
      return
    }
    if (actionMatches('stage.panTool')) {
      onToolChange?.('pan')
      event.preventDefault()
      return
    }
    const fitViewport = (target: StageRect | null) => {
      if (!target || target.width <= 0 || target.height <= 0) return
      const zoom = Math.min(
        8,
        Math.max(
          0.1,
          Math.min(surfaceSize.width / target.width, surfaceSize.height / target.height) * 0.85,
        ),
      )
      onViewportChange({
        zoom,
        x: (surfaceSize.width - target.width * zoom) / 2 - target.x * zoom,
        y: (surfaceSize.height - target.height * zoom) / 2 - target.y * zoom,
      })
    }
    if (actionMatches('stage.fitSelection')) {
      fitViewport(bounds)
      event.preventDefault()
      return
    }
    if (actionMatches('stage.fitFrame')) {
      const frame = activeFrameId ? document.nodes[activeFrameId] : undefined
      fitViewport(frame?.kind === 'frame' ? getNodeWorldBounds(document, frame.id) : null)
      event.preventDefault()
      return
    }
    const viewportCenter = {
      x: surfaceSize.width / 2,
      y: surfaceSize.height / 2,
    }
    if (actionMatches('stage.zoomReset')) {
      onViewportChange(zoomViewportAt(viewport, viewportCenter, 1))
      event.preventDefault()
      return
    }
    if (actionMatches('stage.zoomIn')) {
      onViewportChange(zoomViewportAt(viewport, viewportCenter, viewport.zoom * 1.2))
      event.preventDefault()
      return
    }
    if (actionMatches('stage.zoomOut')) {
      onViewportChange(zoomViewportAt(viewport, viewportCenter, viewport.zoom / 1.2))
      event.preventDefault()
      return
    }
    if (
      actionMatches('stage.toggleGridSnap')
      || actionMatches('stage.toggleSmartSnap')
    ) {
      const gridAction = actionMatches('stage.toggleGridSnap')
      dispatch({
        id: idFactory(),
        type: 'canvas.configure',
        payload: gridAction
          ? {
              grid: {
                ...document.canvas.grid,
                snapEnabled: !document.canvas.grid.snapEnabled,
              },
              smartSnap: document.canvas.smartSnap,
            }
          : {
              grid: document.canvas.grid,
              smartSnap: {
                nodes: !(
                  document.canvas.smartSnap.nodes
                  || document.canvas.smartSnap.guides
                ),
                guides: !(
                  document.canvas.smartSnap.nodes
                  || document.canvas.smartSnap.guides
                ),
              },
            },
        meta: {
          label: gridAction ? messages.toggleGridSnap : messages.toggleSmartSnap,
          source: 'stage',
        },
      })
      event.preventDefault()
      return
    }
    const editableIds = normalizedSelection.filter((id) => !document.nodes[id]?.locked)
    if (editableIds.length === 0) return
    if (actionMatches('edit.duplicate')) {
      const duplicate = createDuplicateCommand(
        document,
        editableIds[0]!,
        idFactory,
        idFactory(),
      )
      if (duplicate) {
        const result = dispatch(duplicate.command)
        if (result.status === 'committed') onSelectedIdsChange([duplicate.rootId])
      }
      event.preventDefault()
      return
    }
    if (actionMatches('edit.group') || actionMatches('edit.ungroup')) {
      if (actionMatches('edit.ungroup') && editableIds.length === 1) {
        const group = document.nodes[editableIds[0]!]
        const result = dispatch(createUngroupCommand(document, editableIds[0]!, idFactory()))
        if (result.status === 'committed' && group?.kind === 'group') {
          onSelectedIdsChange(group.childIds)
        }
      }
      else {
        const groupId = idFactory()
        const result = dispatch(createGroupCommand(document, editableIds, groupId, idFactory()))
        if (result.status === 'committed') onSelectedIdsChange([groupId])
      }
      event.preventDefault()
      return
    }
    if (actionMatches('edit.delete')) {
      dispatch({
        id: idFactory(),
        type: 'node.delete',
        payload: { nodeIds: editableIds },
        meta: {
          label: `Delete ${describeNodeTargets(document, editableIds)}`,
          source: 'stage',
          targetIds: editableIds,
        },
      })
      event.preventDefault()
      return
    }
    const directions: Record<string, StagePoint> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }
    const direction = directions[event.key]
    if (direction) {
      const distance = event.shiftKey ? 10 : 1
      const updates = editableIds.map((nodeId) => {
        const node = document.nodes[nodeId]!
        return {
          nodeId,
          transform: {
            ...node.transform,
            x: node.transform.x + direction.x * distance,
            y: node.transform.y + direction.y * distance,
          },
        }
      })
      dispatch({
        id: idFactory(),
        type: 'node.transform.set',
        payload: { updates },
        meta: {
          label: describeTransform(document, updates, 'move'),
          source: 'stage',
          targetIds: editableIds,
          mergeKey: `stage:nudge:${editableIds.join(',')}`,
        },
      })
      event.preventDefault()
    }
  }

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
      onKeyDown={keyboardCommand}
      onKeyUp={(event) => {
        if (activeTemporaryPanCodeRef.current === keyboardEventCode(event.nativeEvent)) {
          activeTemporaryPanCodeRef.current = null
          controller.send({ type: 'temporary-pan.end' })
        }
      }}
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
        activeTemporaryPanCodeRef.current = null
        controller.send({ type: 'temporary-pan.end' })
        cancelPointerSession(session, true)
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event)
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        event.currentTarget.focus({ preventScroll: true })
        const surface = surfaceRef.current
        if (
          event.defaultPrevented
          || !surface
          || (event.target !== surface && event.target !== event.currentTarget)
        ) return
        beginInteraction({ kind: 'surface' }, event)
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event)
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event)
      }}
      onWheel={(event: ReactWheelEvent<HTMLDivElement>) => {
        onWheel?.(event)
        const surface = surfaceRef.current
        if (
          !surface
          || (!surface.contains(event.target as Node) && event.target !== event.currentTarget)
        ) return
        const point = screenPoint(event, surface)
        if (event.ctrlKey || event.metaKey) {
          const factor = Math.exp(-event.deltaY * 0.002)
          onViewportChange(zoomViewportAt(viewport, point, viewport.zoom * factor))
        }
        else {
          onViewportChange({
            ...viewport,
            x: viewport.x - event.deltaX,
            y: viewport.y - event.deltaY,
          })
        }
        event.preventDefault()
      }}
    >
      <StageRulers
        bounds={bounds}
        horizontalTicks={horizontalTicks}
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
          style={visualGridStyle(document, viewport)}
        />
        <svg aria-hidden="true" className="compose-stage__world-overlay">
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
        </svg>
        <StageSceneLayer
          document={previewDocument}
          registry={registry}
          viewport={viewport}
          onNodePointerDown={beginNode}
        />
        <StageOverlay
          canvasGuides={canvasGuides}
          editableSelection={editableSelection}
          handlePoints={handlePoints}
          label={messages.editingOverlay}
          marqueeScreen={marqueeScreen}
          screenBounds={screenBounds}
          snapGuides={snapGuides}
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
    </div>
  )
}
