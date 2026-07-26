import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'
import type { ComposeSceneTreeNode, ComposeSceneTreeOperation } from './index'
import {
  crossedDragThreshold,
  resolveAutoScrollVelocity,
  resolveDropGeometry,
} from './drag-model'
import { createMoveTarget, getMovingNodeIds } from './tree-model'
import type { IndexedSceneTreeNode, SceneTreeMoveTarget } from './tree-model'

const HOVER_EXPAND_DELAY = 600

interface PointerDragSession {
  pointerId: number
  activeId: string
  selectionIds: readonly string[]
  movingIds: readonly string[]
  previewLabel: string
  startDepth: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  dragging: boolean
}

export interface DragPreviewState {
  x: number
  y: number
  movingIds: readonly string[]
  label: string
}

interface UseSceneTreeDragOptions {
  expandedIds: readonly string[]
  index: ReadonlyMap<string, IndexedSceneTreeNode>
  onExpandedChange?: (nodeIds: readonly string[]) => void
  onOperation?: (operation: ComposeSceneTreeOperation) => void
  onSelectionChange?: (nodeIds: readonly string[]) => void
  query: string
  rows: readonly IndexedSceneTreeNode[]
  scrollRef: RefObject<HTMLDivElement | null>
  selectedIds: readonly string[]
}

function canMove(node: ComposeSceneTreeNode) {
  return !node.locked && node.canMove !== false
}

/** 封装场景树 Pointer Capture、延迟展开与 RAF 自动滚动副作用。 */
export function useSceneTreeDrag({
  expandedIds,
  index,
  onExpandedChange,
  onOperation,
  onSelectionChange,
  query,
  rows,
  scrollRef,
  selectedIds,
}: UseSceneTreeDragOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const [moveTarget, setMoveTarget] = useState<SceneTreeMoveTarget | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null)
  const sessionRef = useRef<PointerDragSession | null>(null)
  const moveTargetRef = useRef<SceneTreeMoveTarget | null>(null)
  const suppressClickRef = useRef(false)
  const hoverExpandIdRef = useRef<string | null>(null)
  const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const autoScrollVelocityRef = useRef(0)
  const updateDropTargetRef = useRef<(clientX: number, clientY: number) => void>(() => undefined)
  const runAutoScrollRef = useRef<() => void>(() => undefined)
  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds])

  const clearHoverExpand = useCallback(() => {
    if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current)
    hoverExpandTimerRef.current = null
    hoverExpandIdRef.current = null
  }, [])

  const stopAutoScroll = useCallback(() => {
    autoScrollVelocityRef.current = 0
    if (autoScrollFrameRef.current !== null) cancelAnimationFrame(autoScrollFrameRef.current)
    autoScrollFrameRef.current = null
  }, [])

  const clearDrag = useCallback(() => {
    sessionRef.current = null
    moveTargetRef.current = null
    setIsDragging(false)
    setMoveTarget(null)
    setDragPreview(null)
    clearHoverExpand()
    stopAutoScroll()
  }, [clearHoverExpand, stopAutoScroll])

  useEffect(() => () => clearDrag(), [clearDrag])

  const scheduleHoverExpand = useCallback((nodeId: string | null) => {
    if (nodeId === hoverExpandIdRef.current) return
    clearHoverExpand()
    if (!nodeId) return
    hoverExpandIdRef.current = nodeId
    hoverExpandTimerRef.current = setTimeout(() => {
      hoverExpandTimerRef.current = null
      const next = new Set(expandedIds)
      next.add(nodeId)
      onExpandedChange?.([...next])
    }, HOVER_EXPAND_DELAY)
  }, [clearHoverExpand, expandedIds, onExpandedChange])

  const updateDropTarget = useCallback((clientX: number, clientY: number) => {
    const session = sessionRef.current
    const scrollElement = scrollRef.current
    if (!session?.dragging || !scrollElement || query.length > 0 || rows.length === 0) return
    const measuredRect = scrollElement.getBoundingClientRect()
    const rectTop = measuredRect.height > 0 ? measuredRect.top : 0
    const rectHeight = measuredRect.height || scrollElement.clientHeight || 320
    const geometry = resolveDropGeometry({
      clientX,
      clientY,
      rectTop,
      rectHeight,
      scrollTop: scrollElement.scrollTop,
      rowDepths: rows.map((row) => row.depth),
      startX: session.startX,
      startDepth: session.startDepth,
    })
    if (!geometry) return
    const hovered = rows[geometry.hoveredIndex]
    if (!hovered) return
    const nextTarget = createMoveTarget(
      index,
      rows,
      session.selectionIds,
      session.activeId,
      geometry.boundaryIndex,
      geometry.requestedDepth,
      geometry.placement,
    )
    moveTargetRef.current = nextTarget
    setMoveTarget(nextTarget)

    const hoverParentId = nextTarget?.operation.parentId === hovered.node.id
      && (hovered.node.children?.length ?? 0) > 0
      && !expandedSet.has(hovered.node.id)
      ? hovered.node.id
      : null
    scheduleHoverExpand(hoverParentId)

    const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
    autoScrollVelocityRef.current = resolveAutoScrollVelocity(
      geometry.relativeY,
      rectHeight,
      scrollElement.scrollTop,
      maxScrollTop,
    )
  }, [expandedSet, index, query.length, rows, scheduleHoverExpand, scrollRef])

  useEffect(() => {
    updateDropTargetRef.current = updateDropTarget
  }, [updateDropTarget])

  const runAutoScroll = useCallback(() => {
    const scrollElement = scrollRef.current
    const session = sessionRef.current
    if (!scrollElement || !session?.dragging || autoScrollVelocityRef.current === 0) {
      autoScrollFrameRef.current = null
      return
    }
    scrollElement.scrollTop += autoScrollVelocityRef.current
    updateDropTargetRef.current(session.lastX, session.lastY)
    autoScrollFrameRef.current = requestAnimationFrame(runAutoScrollRef.current)
  }, [scrollRef])

  useEffect(() => {
    runAutoScrollRef.current = runAutoScroll
  }, [runAutoScroll])

  const ensureAutoScroll = useCallback(() => {
    if (autoScrollVelocityRef.current === 0) {
      stopAutoScroll()
    } else if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScrollRef.current)
    }
  }, [stopAutoScroll])

  const handlePointerDown = useCallback((event: PointerEvent, nodeId: string) => {
    const node = index.get(nodeId)?.node
    const target = event.target as HTMLElement
    if (
      event.button !== 0
      || query.length > 0
      || !node
      || !canMove(node)
      || target.closest('button, input')
    ) return
    const selectionIds = selectedIds.includes(nodeId) ? selectedIds : [nodeId]
    const movingIds = getMovingNodeIds(index, rows, selectionIds, nodeId)
    if (movingIds.length === 0) return
    sessionRef.current = {
      pointerId: event.pointerId,
      activeId: nodeId,
      selectionIds,
      movingIds,
      previewLabel: index.get(movingIds[0])?.node.label ?? node.label,
      startDepth: index.get(nodeId)?.depth ?? 1,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [index, query.length, rows, selectedIds])

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const session = sessionRef.current
    if (!session || session.pointerId !== event.pointerId) return
    session.lastX = event.clientX
    session.lastY = event.clientY
    if (!session.dragging) {
      if (!crossedDragThreshold(session.startX, session.startY, event.clientX, event.clientY)) return
      session.dragging = true
      setIsDragging(true)
      suppressClickRef.current = true
      if (!selectedIds.includes(session.activeId)) onSelectionChange?.([session.activeId])
    }
    setDragPreview({
      x: event.clientX,
      y: event.clientY,
      movingIds: session.movingIds,
      label: session.previewLabel,
    })
    event.preventDefault()
    updateDropTarget(event.clientX, event.clientY)
    ensureAutoScroll()
  }, [ensureAutoScroll, onSelectionChange, selectedIds, updateDropTarget])

  const handlePointerUp = useCallback((event: PointerEvent) => {
    const session = sessionRef.current
    if (!session || session.pointerId !== event.pointerId) return
    if (session.dragging && moveTargetRef.current) onOperation?.(moveTargetRef.current.operation)
    clearDrag()
  }, [clearDrag, onOperation])

  const handlePointerCancel = useCallback((event: PointerEvent) => {
    if (sessionRef.current?.pointerId !== event.pointerId) return
    suppressClickRef.current = false
    clearDrag()
  }, [clearDrag])

  const cancelDrag = useCallback(() => {
    suppressClickRef.current = false
    clearDrag()
  }, [clearDrag])

  const consumeSuppressedClick = useCallback(() => {
    if (!suppressClickRef.current) return false
    suppressClickRef.current = false
    return true
  }, [])

  const handleScroll = useCallback(() => {
    const session = sessionRef.current
    if (session?.dragging) updateDropTarget(session.lastX, session.lastY)
  }, [updateDropTarget])

  return {
    cancelDrag,
    consumeSuppressedClick,
    dragPreview,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleScroll,
    isDragging,
    moveTarget,
  }
}
