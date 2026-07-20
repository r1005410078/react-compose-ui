import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  AddIcon,
  ChevronIcon,
  CubeIcon,
  DocumentIcon,
  EyeIcon,
  LockIcon,
} from './icons'
import type { SceneTreeNode, SceneTreeProps } from './index'
import type { SceneTreeCommand, SceneTreeCommandController } from './index'
import { useSceneTreeCommands } from './use-scene-tree-commands'
import {
  buildTreeIndex,
  createMoveTarget,
  flattenVisibleTree,
  getMovingNodeIds,
  searchTree,
} from './tree-model'
import type { SceneTreeMoveTarget } from './tree-model'

const ROW_HEIGHT = 24
const DROP_EDGE_SIZE = 4
const INDENT_SIZE = 16
const INDENT_BASE = 8
const DRAG_THRESHOLD = 5
const HOVER_EXPAND_DELAY = 600
const AUTO_SCROLL_EDGE = 32
const AUTO_SCROLL_STEP = 8

interface ContextMenuState {
  nodeId: string | null
  x: number
  y: number
}

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

interface DragPreviewState {
  x: number
  y: number
  movingIds: readonly string[]
  label: string
}

function canOperate(node: SceneTreeNode, capability: boolean | undefined) {
  return !node.locked && capability !== false
}

function isWindowsPlatform() {
  if (typeof navigator === 'undefined') return false
  return /^Win/i.test(navigator.platform) || /Windows/i.test(navigator.userAgent)
}

export function SceneTree({
  nodes,
  selectedIds,
  expandedIds,
  onSelectionChange,
  onExpandedChange,
  onOperation,
  commands: providedCommands,
  className,
  ...htmlProps
}: SceneTreeProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectionAnchorRef = useRef<string | null>(selectedIds[selectedIds.length - 1] ?? null)
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [regex, setRegex] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(selectedIds[selectedIds.length - 1] ?? null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [moveTarget, setMoveTarget] = useState<SceneTreeMoveTarget | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null)
  const dragSessionRef = useRef<PointerDragSession | null>(null)
  const moveTargetRef = useRef<SceneTreeMoveTarget | null>(null)
  const suppressClickRef = useRef(false)
  const hoverExpandIdRef = useRef<string | null>(null)
  const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const autoScrollVelocityRef = useRef(0)
  const updateDropTargetRef = useRef<(clientX: number, clientY: number) => void>(() => undefined)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const internalCommands = useSceneTreeCommands({ nodes, selectedIds, onOperation })
  const commands = providedCommands ?? internalCommands

  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds])
  const index = useMemo(() => buildTreeIndex(nodes), [nodes])
  const searchResult = useMemo(
    () => searchTree(nodes, query, { caseSensitive, wholeWord, regex }),
    [caseSensitive, nodes, query, regex, wholeWord],
  )
  const rows = useMemo(
    () => query.length > 0 ? searchResult.rows : flattenVisibleTree(nodes, expandedSet),
    [expandedSet, nodes, query.length, searchResult.rows],
  )

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
    dragSessionRef.current = null
    moveTargetRef.current = null
    setIsDragging(false)
    setMoveTarget(null)
    setDragPreview(null)
    clearHoverExpand()
    stopAutoScroll()
  }, [clearHoverExpand, stopAutoScroll])

  useEffect(() => () => clearDrag(), [clearDrag])

  // TanStack Virtual intentionally returns an imperative instance whose methods
  // are not safe for React Compiler memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (rowIndex) => rows[rowIndex]?.node.id ?? rowIndex,
    getScrollElement: () => scrollRef.current,
    initialRect: { width: 280, height: 320 },
    observeElementRect: (instance, callback) => {
      const element = instance.scrollElement
      if (!element) return
      const reportRect = () => {
        const rect = element.getBoundingClientRect()
        callback({
          width: Math.round(rect.width || element.clientWidth || 280),
          height: Math.round(rect.height || element.clientHeight || 320),
        })
      }
      reportRect()
      const Observer = instance.targetWindow?.ResizeObserver
      if (!Observer) return () => undefined
      const observer = new Observer(reportRect)
      observer.observe(element)
      return () => observer.disconnect()
    },
    overscan: 12,
    useFlushSync: false,
  })

  const requestSelection = useCallback((nodeId: string, event: MouseEvent) => {
    let nextSelection: readonly string[]
    if (event.shiftKey && selectionAnchorRef.current) {
      const anchorIndex = rows.findIndex((row) => row.node.id === selectionAnchorRef.current)
      const nodeIndex = rows.findIndex((row) => row.node.id === nodeId)
      if (anchorIndex >= 0 && nodeIndex >= 0) {
        const start = Math.min(anchorIndex, nodeIndex)
        const end = Math.max(anchorIndex, nodeIndex)
        nextSelection = rows.slice(start, end + 1).map((row) => row.node.id)
      } else {
        nextSelection = [nodeId]
      }
    } else if (event.metaKey || event.ctrlKey) {
      nextSelection = selectedIds.includes(nodeId)
        ? selectedIds.filter((id) => id !== nodeId)
        : [...selectedIds, nodeId]
      selectionAnchorRef.current = nodeId
    } else {
      nextSelection = [nodeId]
      selectionAnchorRef.current = nodeId
    }
    setFocusedId(nodeId)
    onSelectionChange?.(nextSelection)
  }, [onSelectionChange, rows, selectedIds])

  const toggleExpanded = useCallback((nodeId: string) => {
    const next = new Set(expandedIds)
    if (next.has(nodeId)) next.delete(nodeId)
    else next.add(nodeId)
    onExpandedChange?.([...next])
  }, [expandedIds, onExpandedChange])

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
    const session = dragSessionRef.current
    const scrollElement = scrollRef.current
    if (!session?.dragging || !scrollElement || query.length > 0 || rows.length === 0) return

    const measuredRect = scrollElement.getBoundingClientRect()
    const rectTop = measuredRect.height > 0 ? measuredRect.top : 0
    const rectHeight = measuredRect.height || scrollElement.clientHeight || 320
    const contentY = Math.max(0, clientY - rectTop + scrollElement.scrollTop)
    const hoveredIndex = Math.max(0, Math.min(rows.length - 1, Math.floor(contentY / ROW_HEIGHT)))
    const rowOffset = contentY - hoveredIndex * ROW_HEIGHT
    const hovered = rows[hoveredIndex]
    if (!hovered) return
    const placement = rowOffset < DROP_EDGE_SIZE
      ? 'before'
      : rowOffset >= ROW_HEIGHT - DROP_EDGE_SIZE
        ? 'after'
        : 'inside'
    const boundaryIndex = placement === 'after' ? hoveredIndex + 1 : hoveredIndex
    const requestedDepth = placement === 'before'
      ? hovered.depth
      : Math.max(
          1,
          session.startDepth + Math.trunc((clientX - session.startX) / INDENT_SIZE),
        )
    const nextTarget = createMoveTarget(
      index,
      rows,
      session.selectionIds,
      session.activeId,
      boundaryIndex,
      requestedDepth,
      placement,
    )
    moveTargetRef.current = nextTarget
    setMoveTarget(nextTarget)

    const hoverParentId = nextTarget?.operation.parentId === hovered?.node.id
      && (hovered.node.children?.length ?? 0) > 0
      && !expandedSet.has(hovered.node.id)
      ? hovered.node.id
      : null
    scheduleHoverExpand(hoverParentId)

    const relativeY = clientY - rectTop
    const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
    autoScrollVelocityRef.current = relativeY < AUTO_SCROLL_EDGE && scrollElement.scrollTop > 0
      ? -AUTO_SCROLL_STEP
      : relativeY > rectHeight - AUTO_SCROLL_EDGE && scrollElement.scrollTop < maxScrollTop
        ? AUTO_SCROLL_STEP
        : 0
  }, [expandedSet, index, query.length, rows, scheduleHoverExpand])

  updateDropTargetRef.current = updateDropTarget

  const runAutoScroll = useCallback(() => {
    const scrollElement = scrollRef.current
    const session = dragSessionRef.current
    if (!scrollElement || !session?.dragging || autoScrollVelocityRef.current === 0) {
      autoScrollFrameRef.current = null
      return
    }
    scrollElement.scrollTop += autoScrollVelocityRef.current
    updateDropTargetRef.current(session.lastX, session.lastY)
    autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll)
  }, [])

  const ensureAutoScroll = useCallback(() => {
    if (autoScrollVelocityRef.current === 0) {
      stopAutoScroll()
      return
    }
    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll)
    }
  }, [runAutoScroll, stopAutoScroll])

  const handlePointerDown = useCallback((event: PointerEvent, nodeId: string) => {
    const node = index.get(nodeId)?.node
    const target = event.target as HTMLElement
    if (
      event.button !== 0
      || query.length > 0
      || !node
      || !canOperate(node, node.canMove)
      || target.closest('button, input')
    ) return

    const selectionIds = selectedIds.includes(nodeId) ? selectedIds : [nodeId]
    const movingIds = getMovingNodeIds(index, rows, selectionIds, nodeId)
    if (movingIds.length === 0) return
    dragSessionRef.current = {
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
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return
    session.lastX = event.clientX
    session.lastY = event.clientY
    if (!session.dragging) {
      const distance = Math.hypot(
        event.clientX - session.startX,
        event.clientY - session.startY,
      )
      if (distance < DRAG_THRESHOLD) return
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
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return
    if (session.dragging && moveTargetRef.current) {
      onOperation?.(moveTargetRef.current.operation)
    }
    clearDrag()
  }, [clearDrag, onOperation])

  const handlePointerCancel = useCallback((event: PointerEvent) => {
    if (dragSessionRef.current?.pointerId === event.pointerId) {
      suppressClickRef.current = false
      clearDrag()
    }
  }, [clearDrag])

  const focusRow = useCallback((rowIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(rows.length - 1, rowIndex))
    const row = rows[boundedIndex]
    if (!row) return
    setFocusedId(row.node.id)
    virtualizer.scrollToIndex(boundedIndex, { align: 'auto' })
    queueMicrotask(() => {
      const rowElement = [...(scrollRef.current
        ?.querySelectorAll<HTMLElement>('[data-scene-node-id]') ?? [])]
        .find((element) => element.dataset.sceneNodeId === row.node.id)
      rowElement?.focus()
    })
  }, [rows, virtualizer])

  const handleKeyDown = useCallback((event: KeyboardEvent, rowIndex: number) => {
    if (event.key === 'Escape' && dragSessionRef.current?.dragging) {
      suppressClickRef.current = false
      clearDrag()
      event.preventDefault()
      return
    }
    const row = rows[rowIndex]
    if (!row) return
    const commandKey = event.metaKey || event.ctrlKey ? event.key.toLowerCase() : null
    if (commandKey === 'c') commands.execute('copy', row.node.id)
    else if (commandKey === 'x') commands.execute('cut', row.node.id)
    else if (commandKey === 'v') commands.execute('paste-suggested', row.node.id)
    else if (event.key === 'ArrowDown') focusRow(rowIndex + 1)
    else if (event.key === 'ArrowUp') focusRow(rowIndex - 1)
    else if (event.key === 'Home') focusRow(0)
    else if (event.key === 'End') focusRow(rows.length - 1)
    else if (event.key === 'ArrowRight') {
      if ((row.node.children?.length ?? 0) > 0 && !expandedSet.has(row.node.id)) {
        toggleExpanded(row.node.id)
      } else {
        focusRow(rowIndex + 1)
      }
    } else if (event.key === 'ArrowLeft') {
      if (expandedSet.has(row.node.id)) toggleExpanded(row.node.id)
      else if (row.parentId) {
        const parentIndex = rows.findIndex((candidate) => candidate.node.id === row.parentId)
        focusRow(parentIndex)
      }
    } else if (
      event.key === 'Enter'
      && !isWindowsPlatform()
      && canOperate(row.node, row.node.canRename)
    ) {
      setEditingId(row.node.id)
    } else if (event.key === ' ' || (event.key === 'Enter' && isWindowsPlatform())) {
      onSelectionChange?.([row.node.id])
    } else if (
      event.key === 'F2'
      && isWindowsPlatform()
      && canOperate(row.node, row.node.canRename)
    ) {
      setEditingId(row.node.id)
    } else if (event.key === 'Delete') {
      commands.execute('delete', row.node.id)
    } else {
      return
    }
    event.preventDefault()
  }, [clearDrag, commands, expandedSet, focusRow, onSelectionChange, rows, toggleExpanded])

  const commitRename = useCallback((nodeId: string, label: string) => {
    setEditingId(null)
    const trimmedLabel = label.trim()
    if (trimmedLabel && trimmedLabel !== index.get(nodeId)?.node.label) {
      onOperation?.({ type: 'rename', nodeId, label: trimmedLabel })
    }
  }, [index, onOperation])

  const openContextMenu = useCallback((event: MouseEvent, nodeId: string | null) => {
    event.preventDefault()
    if (event.ctrlKey || event.metaKey) {
      setContextMenu(null)
      if (nodeId) requestSelection(nodeId, event)
      return
    }
    if (nodeId && !selectedIds.includes(nodeId)) onSelectionChange?.([nodeId])
    setContextMenu({ nodeId, x: event.clientX, y: event.clientY })
  }, [onSelectionChange, requestSelection, selectedIds])

  useEffect(() => {
    if (!contextMenu) return
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [contextMenu])

  const rootClassName = [
    'st:flex st:h-full st:min-h-0 st:flex-col st:overflow-hidden st:bg-[#111419] st:text-[#c5ccd6]',
    isDragging ? 'st:cursor-grabbing' : null,
    className,
  ].filter(Boolean).join(' ')

  const dragPreviewPortal = dragPreview
    && typeof document !== 'undefined'
    && typeof window !== 'undefined'
    ? createPortal(
        <div
          aria-hidden="true"
          className={dragPreview.movingIds.length > 1
            ? 'st:pointer-events-none st:fixed st:z-[1000] st:grid st:size-9 st:place-items-center st:rounded-full st:border st:border-[#2388ff] st:bg-[#172a3a] st:text-sm st:font-medium st:text-white st:shadow-[0_6px_18px_rgb(0_0_0_/_45%)]'
            : 'st:pointer-events-none st:fixed st:z-[1000] st:w-max st:max-w-[200px] st:truncate st:rounded-full st:border st:border-[#2388ff] st:bg-[#172a3a] st:px-3 st:py-1.5 st:text-sm st:text-white st:shadow-[0_6px_18px_rgb(0_0_0_/_45%)]'}
          data-testid="scene-tree-drag-preview"
          style={{
            left: Math.max(8, Math.min(
              dragPreview.x + 12,
              window.innerWidth - (dragPreview.movingIds.length > 1 ? 44 : 220),
            )),
            top: Math.max(8, Math.min(dragPreview.y + 12, window.innerHeight - 48)),
          }}
        >
          {dragPreview.movingIds.length > 1
            ? dragPreview.movingIds.length
            : dragPreview.label}
        </div>,
        document.body,
      )
    : null

  return (
    <div
      {...htmlProps}
      className={rootClassName}
      data-compose-ui="scene-tree"
      onContextMenu={(event) => openContextMenu(event, null)}
    >
      <div className="st:flex st:h-8 st:shrink-0 st:items-center st:gap-1 st:border-b st:border-[#282e36] st:px-1">
        <button
          aria-label="新增节点"
          className="st:grid st:size-6 st:shrink-0 st:cursor-pointer st:place-items-center st:rounded-[3px] st:border-0 st:bg-transparent st:p-0 st:text-[#b9c1cc] st:hover:bg-[#2a2d2e] st:hover:text-white st:focus-visible:outline-1 st:focus-visible:outline-offset-1 st:focus-visible:outline-[#2388ff]"
          title="新增节点"
          type="button"
          onClick={() => commands.execute('create-suggested')}
        >
          <AddIcon className="st:block st:size-[14px] st:stroke-current st:stroke-[1.6]" />
        </button>
        <div className="st:flex st:h-6 st:min-w-0 st:flex-1 st:items-center st:rounded-[3px] st:border st:border-[#343b44] st:bg-[#15181d] st:focus-within:border-[#007acc] st:focus-within:ring-1 st:focus-within:ring-[#007acc]">
          <input
            aria-invalid={searchResult.error ? 'true' : undefined}
            aria-label="搜索节点"
            className="st:h-full st:w-0 st:min-w-0 st:flex-1 st:cursor-text st:border-0 st:bg-transparent st:px-1.5 st:!text-[11px] st:text-[#e1e5eb] st:outline-none st:placeholder:text-[#77818d]"
            placeholder="搜索"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <SearchToggle active={caseSensitive} label="大小写敏感" onClick={() => setCaseSensitive((value) => !value)}>Aa</SearchToggle>
          <SearchToggle active={wholeWord} label="全词匹配" onClick={() => setWholeWord((value) => !value)}><span className="st:underline">ab</span></SearchToggle>
          <SearchToggle active={regex} label="正则表达式" onClick={() => setRegex((value) => !value)}>.*</SearchToggle>
        </div>
      </div>
      {searchResult.error ? (
        <div className="st:px-3 st:py-1 st:text-xs st:text-[#ff7b86]" role="alert">
          {searchResult.error}
        </div>
      ) : null}
      <div
        ref={scrollRef}
        aria-label={htmlProps['aria-label'] ?? '场景树'}
        className="scene-tree__scroll st:min-h-0 st:min-w-0 st:flex-1 st:overflow-x-hidden st:overflow-y-auto st:outline-none"
        role="treegrid"
        onContextMenu={(event) => openContextMenu(event, null)}
        onLostPointerCapture={handlePointerCancel}
        onPointerCancel={handlePointerCancel}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onScroll={() => {
          const session = dragSessionRef.current
          if (session?.dragging) updateDropTarget(session.lastX, session.lastY)
        }}
      >
            <div
              className="st:relative st:w-full st:max-w-full st:overflow-hidden"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {moveTarget && !('kind' in moveTarget) ? (
                <div
                  aria-hidden="true"
                  className="st:pointer-events-none st:absolute st:z-10 st:h-0.5 st:bg-[#2388ff] st:shadow-[0_0_4px_rgb(35_136_255_/_70%)]"
                  data-testid="scene-tree-drop-indicator"
                  style={{
                    left: INDENT_BASE + (moveTarget.depth - 1) * INDENT_SIZE,
                    right: 4,
                    top: moveTarget.lineIndex * ROW_HEIGHT - 1,
                  }}
                />
              ) : null}
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index]
                if (!row) return null
                const hasChildren = (row.node.children?.length ?? 0) > 0
                const selected = selectedIds.includes(row.node.id)
                const visible = row.node.visible !== false
                const locked = row.node.locked === true
                const isInsideDropTarget = moveTarget !== null
                  && 'kind' in moveTarget
                  && moveTarget.kind === 'inside'
                  && moveTarget.targetNodeId === row.node.id
                return (
                  <div
                key={row.node.id}
                className="st:absolute st:left-0 st:top-0 st:w-full st:max-w-full st:overflow-hidden"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
              <div
                aria-expanded={hasChildren ? (query ? true : expandedSet.has(row.node.id)) : undefined}
                aria-level={row.depth}
                aria-posinset={row.index + 1}
                aria-selected={selected}
                aria-setsize={row.setSize}
                className={`st:mx-1 st:my-px st:box-border st:flex st:h-[22px] st:w-[calc(100%-0.5rem)] st:min-w-0 st:select-none st:items-center st:overflow-hidden st:rounded-[5px] st:pr-0.5 st:text-[13px] st:outline-none ${isDragging ? 'st:cursor-grabbing' : 'st:cursor-default'} ${isInsideDropTarget ? 'st:bg-[#174a78] st:text-white st:shadow-[inset_0_0_0_1px_#2388ff]' : `${selected ? 'st:bg-[#37373d] st:text-white' : 'st:hover:bg-[#2a2d2e]'} st:focus-visible:bg-[#062f4a] st:focus-visible:text-white st:focus-visible:shadow-[inset_0_0_0_1px_#007fd4]`}`}
                data-scene-drop-target={isInsideDropTarget ? 'inside' : undefined}
                data-scene-node-id={row.node.id}
                role="row"
                style={{ touchAction: 'none' }}
                tabIndex={focusedId === row.node.id || (!focusedId && virtualRow.index === 0) ? 0 : -1}
                onClick={(event) => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false
                    return
                  }
                  requestSelection(row.node.id, event)
                }}
                onContextMenu={(event) => {
                  event.stopPropagation()
                  openContextMenu(event, row.node.id)
                }}
                onFocus={() => setFocusedId(row.node.id)}
                onKeyDown={(event) => handleKeyDown(event, virtualRow.index)}
                onPointerDown={(event) => handlePointerDown(event, row.node.id)}
              >
                <span className="st:shrink-0" style={{ width: 8 + (row.depth - 1) * 16 }} />
                <button
                  aria-label={expandedSet.has(row.node.id) ? '折叠节点' : '展开节点'}
                  className="st:grid st:size-5 st:shrink-0 st:cursor-pointer st:place-items-center st:border-0 st:bg-transparent st:text-[#9aa3ae] st:disabled:invisible"
                  disabled={!hasChildren}
                  tabIndex={-1}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleExpanded(row.node.id)
                  }}
                >
                  <ChevronIcon className="st:stroke-current st:stroke-[1.8]" expanded={expandedSet.has(row.node.id)} />
                </button>
                <span className="st:mr-1 st:grid st:size-5 st:shrink-0 st:place-items-center st:text-[#aab3bf]">
                  {row.node.icon ?? (row.parentId === null
                    ? <DocumentIcon className="st:stroke-current st:stroke-[1.6]" />
                    : <CubeIcon className="st:stroke-current st:stroke-[1.5]" />)}
                </span>
                {editingId === row.node.id ? (
                  <input
                    autoFocus
                    aria-label={`重命名 ${row.node.label}`}
                    className="st:min-w-0 st:flex-1 st:rounded-sm st:border st:border-[#2388ff] st:bg-[#0f1216] st:px-1 st:text-sm st:text-white st:outline-none"
                    defaultValue={row.node.label}
                    onBlur={(event) => commitRename(row.node.id, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (event.key === 'Enter') commitRename(row.node.id, event.currentTarget.value)
                      if (event.key === 'Escape') setEditingId(null)
                    }}
                  />
                ) : (
                  <span className="st:min-w-0 st:flex-1 st:truncate" role="gridcell">{row.node.label}</span>
                )}
                <NodeAction
                  disabled={!canOperate(row.node, row.node.canToggleVisibility)}
                  label={visible ? `隐藏 ${row.node.label}` : `显示 ${row.node.label}`}
                  onClick={() => onOperation?.({ type: 'set-visibility', nodeIds: [row.node.id], visible: !visible })}
                >
                  <EyeIcon className="st:stroke-current st:stroke-[1.6]" hidden={!visible} />
                </NodeAction>
                <NodeAction
                  disabled={row.node.canToggleLocked === false}
                  label={locked ? `解锁 ${row.node.label}` : `锁定 ${row.node.label}`}
                  onClick={() => onOperation?.({ type: 'set-locked', nodeIds: [row.node.id], locked: !locked })}
                >
                  <LockIcon className="st:stroke-current st:stroke-[1.6]" locked={locked} />
                </NodeAction>
              </div>
                  </div>
                )
              })}
            </div>
      </div>
      {contextMenu && typeof document !== 'undefined' ? createPortal(
        <SceneTreeContextMenu
          commands={commands}
          menuRef={contextMenuRef}
          nodeId={contextMenu.nodeId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />,
        document.body,
      ) : null}
      {dragPreviewPortal}
    </div>
  )
}

interface MenuEntry {
  command: SceneTreeCommand
  label: string
  danger?: boolean
  separatorBefore?: boolean
}

const NODE_MENU_ENTRIES: readonly MenuEntry[] = [
  { command: 'create-child', label: '新增子节点' },
  { command: 'create-sibling', label: '新增兄弟节点' },
  { command: 'copy', label: '复制', separatorBefore: true },
  { command: 'cut', label: '剪切' },
  { command: 'paste-child', label: '粘贴为子节点' },
  { command: 'paste-sibling', label: '粘贴为兄弟节点' },
  { command: 'delete', label: '删除', danger: true, separatorBefore: true },
]

const ROOT_MENU_ENTRIES: readonly MenuEntry[] = [
  { command: 'create-root', label: '新增根节点' },
  { command: 'paste-root', label: '粘贴到根级' },
]

function SceneTreeContextMenu({
  commands,
  menuRef,
  nodeId,
  onClose,
  x,
  y,
}: {
  commands: SceneTreeCommandController
  menuRef: RefObject<HTMLDivElement | null>
  nodeId: string | null
  onClose: () => void
  x: number
  y: number
}) {
  const entries = nodeId === null ? ROOT_MENU_ENTRIES : NODE_MENU_ENTRIES
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    const padding = 8
    const maxLeft = Math.max(padding, window.innerWidth - rect.width - padding)
    const maxTop = Math.max(padding, window.innerHeight - rect.height - padding)
    menu.style.left = `${Math.max(padding, Math.min(x, maxLeft))}px`
    menu.style.top = `${Math.max(padding, Math.min(y, maxTop))}px`
  }, [menuRef, x, y])
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      onClose()
      event.preventDefault()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const menu = event.currentTarget.closest('[role="menu"]')
    const enabled = [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    if (enabled.length === 0) return
    const current = enabled.indexOf(event.currentTarget)
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? enabled.length - 1
        : event.key === 'ArrowDown'
          ? (current + 1) % enabled.length
          : (current - 1 + enabled.length) % enabled.length
    enabled[next]?.focus()
    event.preventDefault()
  }
  const firstEnabledCommand = entries.find((entry) => commands.isEnabled(entry.command, nodeId))?.command
  return (
    <div
      ref={menuRef}
      className="st:fixed st:z-50 st:min-w-44 st:rounded-[4px] st:border st:border-[#454b55] st:bg-[#1f2329] st:p-1 st:shadow-[0_8px_24px_rgb(0_0_0_/_45%)]"
      role="menu"
      style={{ left: x, top: y }}
    >
      {entries.map((entry) => {
        const enabled = commands.isEnabled(entry.command, nodeId)
        const autoFocus = entry.command === firstEnabledCommand
        return (
          <div key={entry.command}>
            {entry.separatorBefore ? <div className="st:my-1 st:h-px st:bg-[#3a4049]" role="separator" /> : null}
            <button
              autoFocus={autoFocus}
              className={`st:w-full st:rounded-[3px] st:border-0 st:bg-transparent st:px-2.5 st:py-1 st:text-left st:text-[12px] st:text-[#d7dce4] st:hover:bg-[#094771] st:hover:text-white st:focus:bg-[#094771] st:focus:text-white st:focus:outline-none st:disabled:cursor-default st:disabled:text-[#6f7782] st:disabled:hover:bg-transparent ${entry.danger ? 'st:enabled:text-[#ff9aa2]' : ''}`}
              data-danger={entry.danger ? 'true' : undefined}
              disabled={!enabled}
              role="menuitem"
              type="button"
              onClick={() => {
                commands.execute(entry.command, nodeId)
                onClose()
              }}
              onKeyDown={handleKeyDown}
            >
              {entry.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function SearchToggle({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`st:mx-px st:grid st:h-5 st:min-w-5 st:cursor-pointer st:place-items-center st:rounded-sm st:border-0 st:px-0.5 st:!text-[11px] st:focus-visible:outline-1 st:focus-visible:outline-[#75beff] ${active ? 'st:bg-[#094771] st:text-white st:shadow-[inset_0_0_0_1px_#007acc]' : 'st:bg-transparent st:text-[#aeb5be] st:hover:bg-[#2a2d2e] st:hover:text-white'}`}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function NodeAction({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className="st:grid st:size-5 st:shrink-0 st:cursor-pointer st:place-items-center st:border-0 st:bg-transparent st:text-[#929ca9] st:opacity-80 st:hover:text-white st:disabled:cursor-not-allowed st:disabled:opacity-30"
      disabled={disabled}
      tabIndex={-1}
      title={label}
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}
