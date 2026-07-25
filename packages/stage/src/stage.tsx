import { RegistryComponent } from '@compose-ui/component-registry'
import {
  useEffect,
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
import type { StageProps } from './types'
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

function defaultId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `stage-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function screenPoint(
  event: { clientX: number; clientY: number },
  element: HTMLElement,
): StagePoint {
  const rect = element.getBoundingClientRect()
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
  const parentId = getNodeParentId(document, firstId)
  const frameId = frameForNode(document, firstId)
  const candidates: StageGuide[] = []
  const addRect = (rect: StageRect) => {
    candidates.push(
      { axis: 'x', value: rect.x },
      { axis: 'x', value: rect.x + rect.width / 2 },
      { axis: 'x', value: rect.x + rect.width },
      { axis: 'y', value: rect.y },
      { axis: 'y', value: rect.y + rect.height / 2 },
      { axis: 'y', value: rect.y + rect.height },
    )
  }
  if (frameId && !selected.has(frameId)) addRect(getNodeWorldBounds(document, frameId))
  const parent = parentId ? document.nodes[parentId] : null
  const siblingIds = parent && parent.kind !== 'component'
    ? parent.childIds
    : document.rootIds
  for (const id of siblingIds) {
    const node = document.nodes[id]
    if (node?.visible && !selected.has(id)) addRect(getNodeWorldBounds(document, id))
  }
  return candidates
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
  if (!(target instanceof HTMLElement)) return false
  return target.matches('input, textarea, select, [contenteditable="true"]')
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
  selectedIds,
  onSelectedIdsChange,
  activeFrameId,
  onActiveFrameIdChange,
  dragController,
  idFactory = defaultId,
  className,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onWheel,
  ...props
}: StageProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const capturedPointerIdRef = useRef<number | null>(null)
  const pendingRef = useRef<{
    point: StagePoint
    modifiers: Modifiers
  } | null>(null)
  const frameRequestRef = useRef<number | null>(null)
  const [previewTransforms, setPreviewTransforms] = useState<TransformMap>({})
  const [marquee, setMarquee] = useState<StageRect | null>(null)
  const [guides, setGuides] = useState<readonly StageGuide[]>([])
  const [spacePressed, setSpacePressed] = useState(false)
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
      const snapped = snapTranslation(
        gesture.bounds,
        rawDelta,
        snapCandidates(document, gesture.ids),
        viewport.zoom,
        currentModifiers.command,
      )
      gesture.guides = snapped.guides
      gesture.transforms = transformedSelection(
        document,
        gesture.ids,
        translationMatrix(snapped.delta.x, snapped.delta.y),
      )
      setPreviewTransforms(gesture.transforms)
      setGuides(snapped.guides)
      return
    }
    if (gesture.type === 'resize') {
      const nextBounds = resizeBounds(
        gesture.bounds,
        gesture.handle,
        world,
        currentModifiers,
      )
      const mapping = rectMappingMatrix(gesture.bounds, nextBounds)
      gesture.transforms = transformedSelection(document, gesture.ids, mapping, {
        scaleX: nextBounds.width / gesture.bounds.width,
        scaleY: nextBounds.height / gesture.bounds.height,
      })
      setPreviewTransforms(gesture.transforms)
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
    setGuides([])
    releasePointer()
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

  const finishGesture = () => {
    flushPending()
    const gesture = gestureRef.current
    gestureRef.current = null
    releasePointer()
    setMarquee(null)
    setGuides([])
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
    if (!root || tool === 'pan' || spacePressed || event.button === 1) return
    const nextSelection = event.shiftKey
      ? normalizedSelection.includes(node.id)
        ? normalizedSelection.filter((id) => id !== node.id)
        : [...normalizedSelection, node.id]
      : normalizedSelection.includes(node.id) ? normalizedSelection : [node.id]
    onSelectedIdsChange(nextSelection)
    onActiveFrameIdChange(frameForNode(document, node.id))
    if (node.locked) return
    const point = screenPoint(event, root)
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
        const root = rootRef.current
        if (!root) return false
        const seed = registry.createSeed(componentType)
        if (!seed.ok) return true
        const point = clientPoint
          ? screenToWorld(screenPoint({
              clientX: clientPoint.x,
              clientY: clientPoint.y,
            }, root), viewport)
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
        const root = rootRef.current
        if (!root) return false
        const rect = root.getBoundingClientRect()
        const point = clientPoint
          ? screenToWorld(screenPoint({
              clientX: clientPoint.x,
              clientY: clientPoint.y,
            }, root), viewport)
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

  const keyboardCommand = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || event.nativeEvent.isComposing || isEditableTarget(event.target)) return
    if (event.key === ' ') {
      setSpacePressed(true)
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') {
      cancelGesture()
      return
    }
    const editableIds = normalizedSelection.filter((id) => !document.nodes[id]?.locked)
    if (editableIds.length === 0) return
    const commandPressed = event.ctrlKey || event.metaKey
    if (commandPressed && event.key.toLowerCase() === 'd') {
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
    if (commandPressed && event.key.toLowerCase() === 'g') {
      if (event.shiftKey && editableIds.length === 1) {
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
    if (event.key === 'Delete' || event.key === 'Backspace') {
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
      ref={rootRef}
      role="application"
      tabIndex={0}
      onKeyDown={keyboardCommand}
      onKeyUp={(event) => {
        if (event.key === ' ') setSpacePressed(false)
      }}
      onLostPointerCapture={(event) => {
        onLostPointerCapture?.(event)
        capturedPointerIdRef.current = null
        if (gestureRef.current) cancelGesture()
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event)
        cancelGesture()
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (event.defaultPrevented || event.currentTarget !== event.target) return
        const point = screenPoint(event, event.currentTarget)
        if (tool === 'pan' || spacePressed || event.button === 1) {
          gestureRef.current = {
            type: 'pan',
            startScreen: point,
            currentScreen: point,
            startViewport: viewport,
          }
        }
        else if (tool === 'select' && event.button === 0) {
          const world = screenToWorld(point, viewport)
          gestureRef.current = {
            type: 'marquee',
            startWorld: world,
            currentWorld: world,
          }
        }
        if (gestureRef.current) capturePointer(event.currentTarget, event.pointerId)
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event)
        if (!gestureRef.current) return
        scheduleUpdate(screenPoint(event, event.currentTarget), modifiers(event))
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event)
        if (!gestureRef.current) return
        scheduleUpdate(screenPoint(event, event.currentTarget), modifiers(event))
        finishGesture()
      }}
      onWheel={(event: ReactWheelEvent<HTMLDivElement>) => {
        onWheel?.(event)
        const point = screenPoint(event, event.currentTarget)
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
        aria-hidden="true"
        className="compose-stage__grid"
        style={{
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          backgroundSize: `${32 * viewport.zoom}px ${32 * viewport.zoom}px`,
        }}
      />
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
        aria-label="Stage 编辑覆盖层"
        className="compose-stage__overlay"
        role="img"
      >
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
                    if (root) {
                      beginTransform('resize', screenPoint(event, root), handle)
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
                if (root) {
                  beginTransform('rotate', screenPoint(event, root))
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
        {guides.map((guide) => guide.axis === 'x' ? (
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
  )
}
