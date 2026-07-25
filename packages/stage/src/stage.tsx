import { RegistryComponent } from '@compose-ui/component-registry'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
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
import { resolveNodeStyle } from '@compose-ui/core'
import {
  createRulerTicks,
  expandScrollRange,
  scrollAxisToViewport,
  snapResizePoint,
  snapValueToGrid,
  viewportToScrollAxes,
} from './canvas-geometry'
import {
  decomposeMatrix,
  getNodeParentId,
  getNodeWorldBounds,
  getNodeWorldMatrix,
  invertMatrix,
  multiplyMatrices,
  rectMappingMatrix,
  resizeBounds,
  rotationFromPointer,
  rotationMatrixAround,
  screenToWorld,
  snapTranslation,
  translationMatrix,
  unionRects,
  worldToScreen,
  zoomViewportAt,
  type ResizeHandle,
  type StageGuide,
  type StagePoint,
  type StageRect,
} from './geometry'
import type {
  StageKeybinding,
  StageShortcutAction,
  StageProps,
} from './types'
import { StageScrollbar } from './scrollbar'
import {
  createDuplicateCommand,
  createGroupCommand,
  createUngroupCommand,
} from './commands'
import {
  describeNodeCreation,
  describeNodeTargets,
  describeTransform,
} from './transaction-labels'
import { getStageMessages } from './stage-i18n'

type TransformMap = Readonly<Record<string, NodeTransform>>
type Modifiers = { shift: boolean; alt: boolean; command: boolean }
type Gesture =
  | {
      type: 'pan'
      startScreen: StagePoint
      startViewport: StageProps['viewport']
      currentScreen: StagePoint
    }
  | {
      type: 'marquee'
      startWorld: StagePoint
      currentWorld: StagePoint
    }
  | {
      type: 'move'
      ids: readonly string[]
      startWorld: StagePoint
      currentWorld: StagePoint
      bounds: StageRect
      transforms: TransformMap
      guides: readonly StageGuide[]
      modifiers: Modifiers
    }
  | {
      type: 'resize'
      ids: readonly string[]
      handle: ResizeHandle
      bounds: StageRect
      startWorld: StagePoint
      currentWorld: StagePoint
      transforms: TransformMap
      modifiers: Modifiers
    }
  | {
      type: 'rotate'
      ids: readonly string[]
      bounds: StageRect
      startWorld: StagePoint
      currentWorld: StagePoint
      transforms: TransformMap
      modifiers: Modifiers
    }
  | {
      type: 'guide-create'
      guides: readonly {
        id: string
        axis: 'x' | 'y'
        position: number
      }[]
      currentScreen: StagePoint
      modifiers: Modifiers
    }
  | {
      type: 'guide-move'
      guideId: string
      axis: 'x' | 'y'
      position: number
      currentScreen: StagePoint
      modifiers: Modifiers
    }

function defaultId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `stage-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function screenPoint(
  event: { clientX: number; clientY: number },
  element: HTMLElement,
): StagePoint {
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
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
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

function topLevelSelection(document: ComposeDocument, ids: readonly string[]) {
  const selected = new Set(ids)
  return ids.filter((id) => {
    let parentId = getNodeParentId(document, id)
    while (parentId) {
      if (selected.has(parentId)) return false
      parentId = getNodeParentId(document, parentId)
    }
    return true
  })
}

function frameForNode(document: ComposeDocument, nodeId: string): string | null {
  let current: string | null = nodeId
  while (current) {
    const node = document.nodes[current]
    if (node?.kind === 'frame') return current
    current = getNodeParentId(document, current)
  }
  return null
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

function targetTransform(
  document: ComposeDocument,
  nodeId: string,
  targetWorld: ReturnType<typeof getNodeWorldMatrix>,
  width: number,
  height: number,
) {
  const parentId = getNodeParentId(document, nodeId)
  const parentWorld = parentId ? getNodeWorldMatrix(document, parentId) : null
  const local = parentWorld
    ? multiplyMatrices(invertMatrix(parentWorld), targetWorld)
    : targetWorld
  return decomposeMatrix(local, width, height)
}

function transformedSelection(
  document: ComposeDocument,
  ids: readonly string[],
  worldTransform: ReturnType<typeof getNodeWorldMatrix>,
  resize?: { scaleX: number; scaleY: number },
): TransformMap {
  const updates: Record<string, NodeTransform> = {}
  for (const id of ids) {
    const node = document.nodes[id]
    if (!node) continue
    const targetWorld = multiplyMatrices(worldTransform, getNodeWorldMatrix(document, id))
    updates[id] = targetTransform(
      document,
      id,
      targetWorld,
      node.transform.width * (resize?.scaleX ?? 1),
      node.transform.height * (resize?.scaleY ?? 1),
    )
  }
  return updates
}

function selectionBounds(document: ComposeDocument, ids: readonly string[]) {
  return unionRects(ids
    .filter((id) => Boolean(document.nodes[id]?.visible))
    .map((id) => getNodeWorldBounds(document, id)))
}

function rectFromPoints(first: StagePoint, second: StagePoint): StageRect {
  const x = Math.min(first.x, second.x)
  const y = Math.min(first.y, second.y)
  return {
    x,
    y,
    width: Math.abs(first.x - second.x),
    height: Math.abs(first.y - second.y),
  }
}

function intersects(first: StageRect, second: StageRect) {
  return first.x <= second.x + second.width
    && first.x + first.width >= second.x
    && first.y <= second.y + second.height
    && first.y + first.height >= second.y
}

function documentOrder(document: ComposeDocument) {
  const result: string[] = []
  const visit = (id: string) => {
    result.push(id)
    const node = document.nodes[id]
    if (node && node.kind !== 'component') node.childIds.forEach(visit)
  }
  document.rootIds.forEach(visit)
  return result
}

function snapCandidates(
  document: ComposeDocument,
  ids: readonly string[],
): readonly StageGuide[] {
  const selected = new Set(ids)
  const firstId = ids[0]
  if (!firstId) return []
  const excluded = new Set(selected)
  const excludeDescendants = (id: string) => {
    const node = document.nodes[id]
    if (!node || node.kind === 'component') return
    node.childIds.forEach((childId) => {
      excluded.add(childId)
      excludeDescendants(childId)
    })
  }
  ids.forEach(excludeDescendants)
  const candidates: StageGuide[] = []
  const addRect = (rect: StageRect) => {
    candidates.push(
      { axis: 'x', value: rect.x, source: 'node' },
      { axis: 'x', value: rect.x + rect.width / 2, source: 'node' },
      { axis: 'x', value: rect.x + rect.width, source: 'node' },
      { axis: 'y', value: rect.y, source: 'node' },
      { axis: 'y', value: rect.y + rect.height / 2, source: 'node' },
      { axis: 'y', value: rect.y + rect.height, source: 'node' },
    )
  }
  if (document.canvas.smartSnap.nodes) {
    for (const id of documentOrder(document)) {
      const node = document.nodes[id]
      if (node?.visible && !excluded.has(id)) addRect(getNodeWorldBounds(document, id))
    }
  }
  if (document.canvas.smartSnap.guides) {
    document.canvas.guides.forEach((guide) => candidates.push({
      axis: guide.axis,
      value: guide.position,
      source: 'guide',
    }))
  }
  return candidates
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

function formatDimension(value: number) {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function nodeStyle(node: ComposeNode): CSSProperties {
  const visual = resolveNodeStyle(node)
  const shadows: string[] = []
  if (visual.borderWidth > 0) {
    shadows.push(`inset 0 0 0 ${visual.borderWidth}px ${visual.borderColor}`)
  }
  if (visual.shadow) {
    shadows.push(
      `${visual.shadow.offsetX}px ${visual.shadow.offsetY}px ${visual.shadow.blur}px `
      + `${visual.shadow.spread}px ${visual.shadow.color}`,
    )
  }
  return {
    left: node.transform.x,
    top: node.transform.y,
    width: node.transform.width,
    height: node.transform.height,
    transform: `rotate(${node.transform.rotation}deg)`,
    transformOrigin: 'center',
    backgroundColor: visual.backgroundColor,
    borderRadius: visual.borderRadius,
    opacity: visual.opacity,
    boxShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
    overflow: node.kind === 'group' ? 'visible' : 'hidden',
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
  dragController,
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
  const gestureRef = useRef<Gesture | null>(null)
  const capturedPointerIdRef = useRef<number | null>(null)
  const pendingRef = useRef<{
    point: StagePoint
    modifiers: Modifiers
  } | null>(null)
  const frameRequestRef = useRef<number | null>(null)
  const [previewTransforms, setPreviewTransforms] = useState<TransformMap>({})
  const [marquee, setMarquee] = useState<StageRect | null>(null)
  const [snapGuides, setSnapGuides] = useState<readonly StageGuide[]>([])
  const [guidePreview, setGuidePreview] = useState<readonly {
    id: string
    axis: 'x' | 'y'
    position: number
  }[]>([])
  const [surfaceSize, setSurfaceSize] = useState({ width: 900, height: 600 })
  const [scrollRange, setScrollRange] = useState<StageRect | null>(null)
  const [temporaryPanPressed, setTemporaryPanPressed] = useState(false)
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
  const normalizedSelection = selectedIds.filter((id) => Boolean(document.nodes[id]))
  const bounds = selectionBounds(previewDocument, normalizedSelection)
  const editableSelection = normalizedSelection.length > 0
    && normalizedSelection.every((id) => {
      const node = document.nodes[id]
      return node?.visible && !node.locked
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

  const visibleWorld = {
    ...screenToWorld({ x: 0, y: 0 }, viewport),
    width: surfaceSize.width / viewport.zoom,
    height: surfaceSize.height / viewport.zoom,
  }
  const contentBounds = unionRects(Object.values(previewDocument.nodes)
    .filter((node) => node.visible)
    .map((node) => getNodeWorldBounds(previewDocument, node.id)))

  const contentX = contentBounds?.x
  const contentY = contentBounds?.y
  const contentWidth = contentBounds?.width
  const contentHeight = contentBounds?.height
  const visibleX = visibleWorld.x
  const visibleY = visibleWorld.y
  const visibleWidth = visibleWorld.width
  const visibleHeight = visibleWorld.height
  useEffect(() => {
    const request = requestAnimationFrame(() => {
      const content = contentX === undefined
        || contentY === undefined
        || contentWidth === undefined
        || contentHeight === undefined
        ? null
        : {
            x: contentX,
            y: contentY,
            width: contentWidth,
            height: contentHeight,
          }
      setScrollRange((current) => expandScrollRange(current, content, {
        x: visibleX,
        y: visibleY,
        width: visibleWidth,
        height: visibleHeight,
      }))
    })
    return () => cancelAnimationFrame(request)
  }, [
    contentHeight,
    contentWidth,
    contentX,
    contentY,
    visibleHeight,
    visibleWidth,
    visibleX,
    visibleY,
  ])

  const capturePointer = (root: HTMLDivElement, pointerId: number) => {
    try {
      if (typeof root.setPointerCapture === 'function') root.setPointerCapture(pointerId)
      capturedPointerIdRef.current = pointerId
    }
    catch {
      // 部分嵌入式 WebView 不支持 capture；取消路径仍保留文档原子性。
    }
  }

  const releasePointer = () => {
    const pointerId = capturedPointerIdRef.current
    capturedPointerIdRef.current = null
    const root = rootRef.current
    if (!root || pointerId === null) return
    try {
      if (typeof root.releasePointerCapture === 'function') {
        root.releasePointerCapture(pointerId)
      }
    }
    catch {
      // capture 可能已由浏览器在 pointercancel/lost capture 时释放。
    }
  }

  const updateGesture = (point: StagePoint, currentModifiers: Modifiers) => {
    const gesture = gestureRef.current
    if (!gesture) return
    if (gesture.type === 'pan') {
      gesture.currentScreen = point
      onViewportChange({
        ...gesture.startViewport,
        x: gesture.startViewport.x + point.x - gesture.startScreen.x,
        y: gesture.startViewport.y + point.y - gesture.startScreen.y,
      })
      return
    }
    const world = screenToWorld(point, viewport)
    if (gesture.type === 'guide-create') {
      gesture.currentScreen = point
      gesture.modifiers = currentModifiers
      gesture.guides = gesture.guides.map((guide) => ({
        ...guide,
        position: snapValueToGrid(
          guide.axis === 'x' ? world.x : world.y,
          guide.axis === 'x' ? document.canvas.grid.stepX : document.canvas.grid.stepY,
          guide.axis === 'x' ? document.canvas.grid.offsetX : document.canvas.grid.offsetY,
          document.canvas.grid.snapEnabled && !currentModifiers.command,
        ),
      }))
      setGuidePreview(gesture.guides)
      return
    }
    if (gesture.type === 'guide-move') {
      gesture.currentScreen = point
      gesture.modifiers = currentModifiers
      gesture.position = snapValueToGrid(
        gesture.axis === 'x' ? world.x : world.y,
        gesture.axis === 'x' ? document.canvas.grid.stepX : document.canvas.grid.stepY,
        gesture.axis === 'x' ? document.canvas.grid.offsetX : document.canvas.grid.offsetY,
        document.canvas.grid.snapEnabled && !currentModifiers.command,
      )
      setGuidePreview([{
        id: gesture.guideId,
        axis: gesture.axis,
        position: gesture.position,
      }])
      return
    }
    if (gesture.type === 'marquee') {
      gesture.currentWorld = world
      setMarquee(rectFromPoints(gesture.startWorld, world))
      return
    }
    gesture.currentWorld = world
    gesture.modifiers = currentModifiers
    if (gesture.type === 'move') {
      const rawDelta = {
        x: world.x - gesture.startWorld.x,
        y: world.y - gesture.startWorld.y,
      }
      if (Math.hypot(rawDelta.x, rawDelta.y) * viewport.zoom < 2) {
        gesture.transforms = {}
        gesture.guides = []
        setPreviewTransforms({})
        setSnapGuides([])
        return
      }
      const snapped = snapTranslation(
        gesture.bounds,
        rawDelta,
        snapCandidates(document, gesture.ids),
        viewport.zoom,
        currentModifiers.command,
        {
          stepX: document.canvas.grid.stepX,
          stepY: document.canvas.grid.stepY,
          offsetX: document.canvas.grid.offsetX,
          offsetY: document.canvas.grid.offsetY,
          enabled: document.canvas.grid.snapEnabled,
        },
      )
      gesture.guides = snapped.guides
      gesture.transforms = transformedSelection(
        document,
        gesture.ids,
        translationMatrix(snapped.delta.x, snapped.delta.y),
      )
      setPreviewTransforms(gesture.transforms)
      setSnapGuides(snapped.guides)
      return
    }
    if (gesture.type === 'resize') {
      const snapped = snapResizePoint({
        point: world,
        handle: gesture.handle,
        candidates: snapCandidates(document, gesture.ids),
        canvas: document.canvas,
        zoom: viewport.zoom,
        disabled: currentModifiers.command,
      })
      const nextBounds = resizeBounds(
        gesture.bounds,
        gesture.handle,
        snapped.point,
        currentModifiers,
      )
      const mapping = rectMappingMatrix(gesture.bounds, nextBounds)
      gesture.transforms = transformedSelection(document, gesture.ids, mapping, {
        scaleX: nextBounds.width / gesture.bounds.width,
        scaleY: nextBounds.height / gesture.bounds.height,
      })
      setPreviewTransforms(gesture.transforms)
      setSnapGuides(snapped.guides)
      return
    }
    const center = {
      x: gesture.bounds.x + gesture.bounds.width / 2,
      y: gesture.bounds.y + gesture.bounds.height / 2,
    }
    const angle = rotationFromPointer(
      center,
      gesture.startWorld,
      world,
      currentModifiers.shift,
    )
    gesture.transforms = transformedSelection(
      document,
      gesture.ids,
      rotationMatrixAround(center, angle),
    )
    setPreviewTransforms(gesture.transforms)
  }

  const flushPending = () => {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    if (frameRequestRef.current !== null) {
      cancelAnimationFrame(frameRequestRef.current)
      frameRequestRef.current = null
    }
    updateGesture(pending.point, pending.modifiers)
  }

  const scheduleUpdate = (point: StagePoint, currentModifiers: Modifiers) => {
    pendingRef.current = { point, modifiers: currentModifiers }
    if (frameRequestRef.current !== null) return
    let ranSynchronously = false
    const request = requestAnimationFrame(() => {
      ranSynchronously = true
      frameRequestRef.current = null
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending) updateGesture(pending.point, pending.modifiers)
    })
    frameRequestRef.current = ranSynchronously ? null : request
  }

  const cancelGesture = () => {
    if (frameRequestRef.current !== null) cancelAnimationFrame(frameRequestRef.current)
    frameRequestRef.current = null
    pendingRef.current = null
    gestureRef.current = null
    setPreviewTransforms({})
    setMarquee(null)
    setSnapGuides([])
    setGuidePreview([])
    releasePointer()
  }

  useEffect(() => {
    const stopTemporaryPan = () => {
      activeTemporaryPanCodeRef.current = null
      setTemporaryPanPressed(false)
      if (gestureRef.current?.type === 'pan') cancelGesture()
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (activeTemporaryPanCodeRef.current === keyboardEventCode(event)) {
        stopTemporaryPan()
      }
    }
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', stopTemporaryPan)
    return () => {
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', stopTemporaryPan)
    }
  })

  const beginPan = (
    event: ReactPointerEvent<Element>,
    root: HTMLDivElement,
    surface: HTMLDivElement,
  ) => {
    const point = screenPoint(event, surface)
    gestureRef.current = {
      type: 'pan',
      startScreen: point,
      currentScreen: point,
      startViewport: viewport,
    }
    capturePointer(root, event.pointerId)
  }

  const beginTransform = (
    type: 'move' | 'resize' | 'rotate',
    point: StagePoint,
    handle?: ResizeHandle,
  ) => {
    const ids = topLevelSelection(document, normalizedSelection)
      .filter((id) => !document.nodes[id]?.locked)
    const initialBounds = selectionBounds(document, ids)
    if (!initialBounds || ids.length === 0) return
    const world = screenToWorld(point, viewport)
    if (type === 'move') {
      gestureRef.current = {
        type,
        ids,
        startWorld: world,
        currentWorld: world,
        bounds: initialBounds,
        transforms: {},
        guides: [],
        modifiers: { shift: false, alt: false, command: false },
      }
    }
    else if (type === 'resize' && handle) {
      gestureRef.current = {
        type,
        ids,
        handle,
        startWorld: world,
        currentWorld: world,
        bounds: initialBounds,
        transforms: {},
        modifiers: { shift: false, alt: false, command: false },
      }
    }
    else {
      gestureRef.current = {
        type: 'rotate',
        ids,
        startWorld: world,
        currentWorld: world,
        bounds: initialBounds,
        transforms: {},
        modifiers: { shift: false, alt: false, command: false },
      }
    }
  }

  const beginGuideCreate = (
    axes: readonly ('x' | 'y')[],
    event: ReactPointerEvent<Element>,
  ) => {
    event.stopPropagation()
    if (event.button !== 0) return
    const root = rootRef.current
    const surface = surfaceRef.current
    if (!root || !surface) return
    root.focus({ preventScroll: true })
    const point = screenPoint(event, surface)
    const world = screenToWorld(point, viewport)
    const currentModifiers = modifiers(event)
    const created = axes.map((axis) => ({
      id: idFactory(),
      axis,
      position: snapValueToGrid(
        axis === 'x' ? world.x : world.y,
        axis === 'x' ? document.canvas.grid.stepX : document.canvas.grid.stepY,
        axis === 'x' ? document.canvas.grid.offsetX : document.canvas.grid.offsetY,
        document.canvas.grid.snapEnabled && !currentModifiers.command,
      ),
    }))
    gestureRef.current = {
      type: 'guide-create',
      guides: created,
      currentScreen: point,
      modifiers: currentModifiers,
    }
    setGuidePreview(created)
    capturePointer(root, event.pointerId)
  }

  const beginGuideMove = (
    guide: ComposeDocument['canvas']['guides'][number],
    event: ReactPointerEvent<Element>,
  ) => {
    event.stopPropagation()
    if (event.button !== 0) return
    const root = rootRef.current
    const surface = surfaceRef.current
    if (!root || !surface) return
    const point = screenPoint(event, surface)
    gestureRef.current = {
      type: 'guide-move',
      guideId: guide.id,
      axis: guide.axis,
      position: guide.position,
      currentScreen: point,
      modifiers: modifiers(event),
    }
    setGuidePreview([guide])
    capturePointer(root, event.pointerId)
  }

  const finishGesture = () => {
    flushPending()
    const gesture = gestureRef.current
    gestureRef.current = null
    releasePointer()
    setMarquee(null)
    setSnapGuides([])
    setGuidePreview([])
    setPreviewTransforms({})
    if (!gesture) return
    if (gesture.type === 'marquee') {
      const area = rectFromPoints(gesture.startWorld, gesture.currentWorld)
      if (area.width < 1 && area.height < 1) {
        onSelectedIdsChange([])
        return
      }
      const ids = documentOrder(document).filter((id) => {
        const node = document.nodes[id]
        return node
          && node.kind !== 'frame'
          && node.visible
          && !node.locked
          && intersects(area, getNodeWorldBounds(document, id))
      })
      onSelectedIdsChange(ids)
      return
    }
    if (gesture.type === 'pan') return
    if (gesture.type === 'guide-create') {
      const created = gesture.guides.filter((guide) => guide.axis === 'x'
        ? gesture.currentScreen.y >= 0
        : gesture.currentScreen.x >= 0)
      if (created.length === 0) return
      const commands = created.map((guide) => ({
        id: idFactory(),
        type: 'canvas.guide.create',
        payload: { guide },
      }))
      dispatch(created.length === 1
        ? {
            ...commands[0]!,
            meta: { label: messages.createGuide, source: 'stage' },
          }
        : {
            id: idFactory(),
            type: 'transaction.batch',
            payload: { commands },
            meta: { label: messages.createGuides, source: 'stage' },
          })
      return
    }
    if (gesture.type === 'guide-move') {
      const shouldDelete = gesture.axis === 'x'
        ? gesture.currentScreen.y < 0
        : gesture.currentScreen.x < 0
      dispatch({
        id: idFactory(),
        type: shouldDelete ? 'canvas.guide.delete' : 'canvas.guide.move',
        payload: shouldDelete
          ? { guideId: gesture.guideId }
          : { guideId: gesture.guideId, position: gesture.position },
        meta: {
          label: shouldDelete ? messages.deleteGuide : messages.moveGuide,
          source: 'stage',
        },
      })
      return
    }
    const updates = Object.entries(gesture.transforms).map(([nodeId, transform]) => ({
      nodeId,
      transform: { ...transform },
    }))
    if (updates.length === 0) return
    dispatch({
      id: idFactory(),
      type: 'node.transform.set',
      payload: { updates },
      meta: {
        label: describeTransform(document, updates, gesture.type),
        source: 'stage',
        targetIds: gesture.ids,
      },
    })
  }

  const beginNode = (node: ComposeNode, event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const root = rootRef.current
    const surface = surfaceRef.current
    if (!root || !surface) return
    if (tool === 'pan' || temporaryPanPressed || event.button === 1) {
      beginPan(event, root, surface)
      return
    }
    const nextSelection = event.shiftKey
      ? normalizedSelection.includes(node.id)
        ? normalizedSelection.filter((id) => id !== node.id)
        : [...normalizedSelection, node.id]
      : normalizedSelection.includes(node.id) ? normalizedSelection : [node.id]
    onSelectedIdsChange(nextSelection)
    onActiveFrameIdChange(frameForNode(document, node.id))
    if (node.locked) return
    const point = screenPoint(event, surface)
    const ids = topLevelSelection(document, nextSelection)
    const nextBounds = selectionBounds(document, ids)
    if (!nextBounds) return
    const world = screenToWorld(point, viewport)
    gestureRef.current = {
      type: 'move',
      ids,
      startWorld: world,
      currentWorld: world,
      bounds: nextBounds,
      transforms: {},
      guides: [],
      modifiers: modifiers(event),
    }
    capturePointer(root, event.pointerId)
  }

  useEffect(() => {
    if (!dragController) return
    return dragController.registerTarget({
      drop(componentType, clientPoint) {
        const surface = surfaceRef.current
        if (!surface) return false
        const seed = registry.createSeed(componentType)
        if (!seed.ok) return true
        const point = clientPoint
            ? screenToWorld(screenPoint({
                clientX: clientPoint.x,
                clientY: clientPoint.y,
            }, surface), viewport)
          : (() => {
              const frame = activeFrameId ? document.nodes[activeFrameId] : undefined
              return frame?.kind === 'frame'
                ? {
                    x: frame.transform.x + frame.transform.width / 2,
                    y: frame.transform.y + frame.transform.height / 2,
                  }
                : { x: 0, y: 0 }
            })()
        const frame = document.rootIds
          .map((id) => document.nodes[id])
          .find((node) => node?.kind === 'frame'
            && node.visible
            && !node.locked
            && point.x >= node.transform.x
            && point.x <= node.transform.x + node.transform.width
            && point.y >= node.transform.y
            && point.y <= node.transform.y + node.transform.height)
        const nodeId = idFactory()
        const node = {
          id: nodeId,
          kind: 'component' as const,
          name: seed.seed.name,
          visible: true,
          locked: false,
          transform: {
            x: frame?.kind === 'frame'
              ? point.x - frame.transform.x - seed.seed.width / 2
              : point.x,
            y: frame?.kind === 'frame'
              ? point.y - frame.transform.y - seed.seed.height / 2
              : point.y,
            width: seed.seed.width,
            height: seed.seed.height,
            rotation: 0,
          },
          componentType,
          props: seed.seed.props,
          ...(seed.seed.style ? { style: seed.seed.style } : {}),
        }
        const result = dispatch({
          id: idFactory(),
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
          onSelectedIdsChange([nodeId])
          onActiveFrameIdChange(frame.id)
        }
        return true
      },
      dropFrame(preset, clientPoint) {
        const surface = surfaceRef.current
        if (!surface) return false
        const surfaceRect = surface.getBoundingClientRect()
        const rect = surfaceRect.width > 0 && surfaceRect.height > 0
          ? surfaceRect
          : rootRef.current?.getBoundingClientRect() ?? surfaceRect
        const point = clientPoint
            ? screenToWorld(screenPoint({
                clientX: clientPoint.x,
                clientY: clientPoint.y,
            }, surface), viewport)
          : screenToWorld({ x: rect.width / 2, y: rect.height / 2 }, viewport)
        const nodeId = idFactory()
        let style: ComposeFrameNode['style']
        let validPreset = true
        try {
          style = preset.createDefaultStyle()
        }
        catch {
          // factory 异常仍需通过 runtime 产生可观察的 rejected，而不是静默丢失用户意图。
          validPreset = false
        }
        const node: ComposeFrameNode = {
          id: nodeId,
          kind: 'frame',
          name: preset.name,
          visible: true,
          locked: false,
          transform: {
            x: point.x - preset.defaultSize.width / 2,
            y: point.y - preset.defaultSize.height / 2,
            width: validPreset ? preset.defaultSize.width : 0,
            height: preset.defaultSize.height,
            rotation: 0,
          },
          style,
          childIds: [],
        }
        const result = dispatch({
          id: idFactory(),
          type: 'frame.create',
          payload: {
            node: node as unknown as JsonValue,
            index: document.rootIds.length,
          },
          meta: {
            label: describeNodeCreation(node),
            source: 'component-palette',
            targetIds: [nodeId],
          },
        })
        if (result.status === 'committed') {
          onSelectedIdsChange([nodeId])
          onActiveFrameIdChange(nodeId)
        }
        return true
      },
    })
  }, [
    activeFrameId,
    dispatch,
    document,
    dragController,
    idFactory,
    onActiveFrameIdChange,
    onSelectedIdsChange,
    registry,
    viewport,
  ])

  const renderNode = (nodeId: string) => {
    const node = previewDocument.nodes[nodeId]
    if (!node?.visible) return null
    return (
      <div
        className={`compose-stage__node is-${node.kind}${node.locked ? ' is-locked' : ''}`}
        data-node-id={node.id}
        data-testid={node.kind === 'frame' ? 'stage-frame' : `stage-node-${node.id}`}
        key={node.id}
        style={nodeStyle(node)}
        onPointerDown={(event) => beginNode(node, event)}
      >
        {node.kind === 'component'
          ? <RegistryComponent mode="editor" node={node} registry={registry} />
          : node.childIds.map(renderNode)}
      </div>
    )
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
  const activeScrollRange = scrollRange
    ?? expandScrollRange(null, contentBounds, visibleWorld)
  const scrollAxes = viewportToScrollAxes(viewport, surfaceSize, activeScrollRange)

  const keyboardCommand = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || event.nativeEvent.isComposing || isEditableTarget(event.target)) return
    const actionMatches = (action: StageShortcutAction) =>
      resolvedShortcuts[action].some((binding) =>
        isStageShortcutMatch(event.nativeEvent, binding))
    if (actionMatches('stage.temporaryPan')) {
      activeTemporaryPanCodeRef.current = keyboardEventCode(event.nativeEvent)
      setTemporaryPanPressed(true)
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
          setTemporaryPanPressed(false)
          if (gestureRef.current?.type === 'pan') cancelGesture()
        }
      }}
      onLostPointerCapture={(event) => {
        onLostPointerCapture?.(event)
        capturedPointerIdRef.current = null
        activeTemporaryPanCodeRef.current = null
        setTemporaryPanPressed(false)
        if (gestureRef.current) cancelGesture()
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event)
        activeTemporaryPanCodeRef.current = null
        setTemporaryPanPressed(false)
        cancelGesture()
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
        const point = screenPoint(event, surface)
        if (tool === 'pan' || temporaryPanPressed || event.button === 1) {
          beginPan(event, event.currentTarget, surface)
        }
        else if (tool === 'select' && event.button === 0) {
          const world = screenToWorld(point, viewport)
          gestureRef.current = {
            type: 'marquee',
            startWorld: world,
            currentWorld: world,
          }
        }
        if (gestureRef.current && gestureRef.current.type !== 'pan') {
          capturePointer(event.currentTarget, event.pointerId)
        }
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event)
        const surface = surfaceRef.current
        if (!gestureRef.current || !surface) return
        scheduleUpdate(screenPoint(event, surface), modifiers(event))
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event)
        const surface = surfaceRef.current
        if (!gestureRef.current || !surface) return
        scheduleUpdate(screenPoint(event, surface), modifiers(event))
        finishGesture()
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
      <div
        aria-label={messages.rulerOrigin}
        className="compose-stage__ruler-corner"
        data-testid="stage-ruler-corner"
        onPointerDown={(event) => beginGuideCreate(['x', 'y'], event)}
      >
        <span aria-hidden="true">＋</span>
      </div>
      <div
        aria-label={messages.horizontalRuler}
        className="compose-stage__ruler is-horizontal"
        data-testid="stage-ruler-x"
        onPointerDown={(event) => beginGuideCreate(['x'], event)}
      >
        <svg aria-hidden="true">
          {horizontalTicks.map((tick) => (
            <g
              data-world-value={tick.value}
              key={tick.value}
              transform={`translate(${tick.screen} 0)`}
            >
              <line className={tick.major ? 'is-major' : ''} x1="0" x2="0" y1={tick.major ? 12 : 17} y2="24" />
              {tick.label ? <text x="3" y="10">{tick.label}</text> : null}
            </g>
          ))}
          {screenBounds ? (
            <g className="compose-stage__ruler-selection" data-testid="stage-ruler-selection-x">
              <line x1={screenBounds.x} x2={screenBounds.x + screenBounds.width} y1="21" y2="21" />
              <line x1={screenBounds.x} x2={screenBounds.x} y1="15" y2="24" />
              <line x1={screenBounds.x + screenBounds.width} x2={screenBounds.x + screenBounds.width} y1="15" y2="24" />
              <text x={screenBounds.x + screenBounds.width / 2} y="19" textAnchor="middle">
                {formatDimension(bounds!.width)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      <div
        aria-label={messages.verticalRuler}
        className="compose-stage__ruler is-vertical"
        data-testid="stage-ruler-y"
        onPointerDown={(event) => beginGuideCreate(['y'], event)}
      >
        <svg aria-hidden="true">
          {verticalTicks.map((tick) => (
            <g
              data-world-value={tick.value}
              key={tick.value}
              transform={`translate(0 ${tick.screen})`}
            >
              <line className={tick.major ? 'is-major' : ''} x1={tick.major ? 12 : 17} x2="24" y1="0" y2="0" />
              {tick.label ? (
                <text x="3" y="-3" transform="rotate(90)">
                  {tick.label}
                </text>
              ) : null}
            </g>
          ))}
          {screenBounds ? (
            <g className="compose-stage__ruler-selection" data-testid="stage-ruler-selection-y">
              <line x1="21" x2="21" y1={screenBounds.y} y2={screenBounds.y + screenBounds.height} />
              <line x1="15" x2="24" y1={screenBounds.y} y2={screenBounds.y} />
              <line x1="15" x2="24" y1={screenBounds.y + screenBounds.height} y2={screenBounds.y + screenBounds.height} />
              <text
                textAnchor="middle"
                transform={`translate(18 ${screenBounds.y + screenBounds.height / 2}) rotate(-90)`}
              >
                {formatDimension(bounds!.height)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
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
        <div
          className="compose-stage__scene"
          data-testid="stage-scene-layer"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          {previewDocument.rootIds.map(renderNode)}
        </div>
        <svg
          aria-label={messages.editingOverlay}
          className="compose-stage__overlay"
          role="img"
        >
          {canvasGuides.map((guide) => guide.axis === 'x' ? (
            <line
              className="compose-stage__canvas-guide"
              data-guide-id={guide.id}
              data-testid={`stage-canvas-guide-${guide.id}`}
              key={guide.id}
              x1={worldToScreen({ x: guide.position, y: 0 }, viewport).x}
              x2={worldToScreen({ x: guide.position, y: 0 }, viewport).x}
              y1="0"
              y2="100%"
              onPointerDown={(event) => beginGuideMove(guide, event)}
            />
          ) : (
            <line
              className="compose-stage__canvas-guide"
              data-guide-id={guide.id}
              data-testid={`stage-canvas-guide-${guide.id}`}
              key={guide.id}
              x1="0"
              x2="100%"
              y1={worldToScreen({ x: 0, y: guide.position }, viewport).y}
              y2={worldToScreen({ x: 0, y: guide.position }, viewport).y}
              onPointerDown={(event) => beginGuideMove(guide, event)}
            />
          ))}
          {screenBounds ? (
            <rect
              className="compose-stage__selection"
              data-testid="stage-selection-bounds"
              height={screenBounds.height}
              width={screenBounds.width}
              x={screenBounds.x}
              y={screenBounds.y}
            />
          ) : null}
          {editableSelection && handlePoints ? (
            <>
              {(Object.entries(handlePoints) as [ResizeHandle, readonly [number, number]][])
                .map(([handle, [x, y]]) => (
                  <rect
                    className="compose-stage__handle"
                    data-testid={`stage-resize-${handle}`}
                    height="8"
                    key={handle}
                    width="8"
                    x={x - 4}
                    y={y - 4}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      const root = rootRef.current
                      const surface = surfaceRef.current
                      if (root && surface) {
                        beginTransform('resize', screenPoint(event, surface), handle)
                        capturePointer(root, event.pointerId)
                      }
                    }}
                  />
                ))}
              <circle
                className="compose-stage__handle compose-stage__rotation"
                cx={handlePoints.n[0]}
                cy={handlePoints.n[1] - 24}
                data-testid="stage-rotation-handle"
                r="5"
                onPointerDown={(event) => {
                  event.stopPropagation()
                  const root = rootRef.current
                  const surface = surfaceRef.current
                  if (root && surface) {
                    beginTransform('rotate', screenPoint(event, surface))
                    capturePointer(root, event.pointerId)
                  }
                }}
              />
            </>
          ) : null}
          {marqueeScreen ? (
            <rect
              className="compose-stage__marquee"
              data-testid="stage-marquee"
              height={marqueeScreen.height}
              width={marqueeScreen.width}
              x={marqueeScreen.x}
              y={marqueeScreen.y}
            />
          ) : null}
          {snapGuides.map((guide) => guide.axis === 'x' ? (
            <line
              className="compose-stage__guide"
              data-testid="stage-snap-guide-x"
              key={`x:${guide.value}`}
              x1={worldToScreen({ x: guide.value, y: 0 }, viewport).x}
              x2={worldToScreen({ x: guide.value, y: 0 }, viewport).x}
              y1="0"
              y2="100%"
            />
          ) : (
            <line
              className="compose-stage__guide"
              data-testid="stage-snap-guide-y"
              key={`y:${guide.value}`}
              x1="0"
              x2="100%"
              y1={worldToScreen({ x: 0, y: guide.value }, viewport).y}
              y2={worldToScreen({ x: 0, y: guide.value }, viewport).y}
            />
          ))}
        </svg>
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
