import { useVirtualizer } from '@tanstack/react-virtual'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { createTreeIndex, createTreeMove, flattenTree } from './tree-model'
import type { IndexedTreeItem } from './tree-model'
import type {
  TreeItemRenderContext,
  TreeMoveOperation,
  TreeProps,
} from './tree-types'

const DEFAULT_ROW_HEIGHT = 24
const INDENT = 16
const INDENT_BASE = 8
const DRAG_THRESHOLD = 5
const AUTO_SCROLL_EDGE = 32
const AUTO_SCROLL_STEP = 8
const HOVER_EXPAND_DELAY = 600

interface DragSession {
  pointerId: number
  activeId: string
  startX: number
  startY: number
  lastX: number
  lastY: number
  startDepth: number
  dragging: boolean
}

interface MoveTarget {
  operation: TreeMoveOperation
  kind: 'inside' | 'line'
  targetId?: string
  depth?: number
  lineIndex?: number
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function hasChildren<T>(
  row: IndexedTreeItem<T>,
  props: TreeProps<T>,
) {
  return props.adapter.hasChildren?.(row.item)
    ?? (props.adapter.getChildren(row.item)?.length ?? 0) > 0
}

function contextFor<T>(
  row: IndexedTreeItem<T>,
  props: TreeProps<T>,
  focusedId: string | null,
): TreeItemRenderContext<T> {
  return {
    item: row.item,
    id: row.id,
    parentId: row.parentId,
    depth: row.depth,
    selected: props.selectedIds.includes(row.id),
    expanded: props.expandedIds.includes(row.id),
    focused: focusedId === row.id,
    hasChildren: hasChildren(row, props),
  }
}

/**
 * 渲染无领域语义的受控、虚拟化 Tree。
 *
 * @remarks
 * Tree 只拥有瞬时焦点、Pointer 拖拽和虚拟列表状态。业务 items、选择、展开和结构修改始终由
 * 宿主控制。过滤仅改变当前可见行，不会改写 expandedIds。
 *
 * @public
 */
export function Tree<T>(props: TreeProps<T>) {
  const {
    items,
    adapter,
    selectedIds,
    expandedIds,
    onSelectionChange,
    onExpandedChange,
    onMove,
    onActivate,
    canDrop,
    filter,
    selectionMode = 'multiple',
    renderIcon,
    renderLabel,
    renderActions,
    renderDragPreview,
    onItemContextMenu,
    onBackgroundContextMenu,
    onItemKeyDown,
    onItemDoubleClick,
    getExpandLabel,
    getCollapseLabel,
    getItemAttributes,
    scrollRef: providedScrollRef,
    rowHeight = DEFAULT_ROW_HEIGHT,
    dropIndicatorTestId = 'tree-drop-indicator',
    dragPreviewTestId = 'tree-drag-preview',
    dropTargetDataAttribute = 'data-tree-drop-target',
    className,
    style,
    ...htmlProps
  } = props
  const theme = useComposeThemeContext()
  const i18n = useComposeI18nContext()
  const defaultExpandLabel = i18n?.formatMessage(
    'components.tree.expand',
    i18n.locale === 'en-US' ? 'Expand' : '展开',
  ) ?? '展开'
  const defaultCollapseLabel = i18n?.formatMessage(
    'components.tree.collapse',
    i18n.locale === 'en-US' ? 'Collapse' : '折叠',
  ) ?? '折叠'
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const scrollRef = providedScrollRef ?? internalScrollRef
  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds])
  const treeIndex = useMemo(() => createTreeIndex(items, adapter), [adapter, items])
  const rows = useMemo(
    () => flattenTree(items, adapter, { expandedIds: expandedSet, filter }),
    [adapter, expandedSet, filter, items],
  )
  const [focusedId, setFocusedId] = useState<string | null>(
    selectedIds[selectedIds.length - 1] ?? null,
  )
  const selectionAnchorRef = useRef<string | null>(
    selectedIds[selectedIds.length - 1] ?? null,
  )
  const dragRef = useRef<DragSession | null>(null)
  const [dragging, setDragging] = useState(false)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoScrollRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  /** 右键后短时抑制兼容 click；部分浏览器/宿主会在 contextmenu 后补发 button=0 的 click。 */
  const suppressClickUntilRef = useRef(0)

  // TanStack Virtual 暴露命令式实例，不适合由 React Compiler 自动记忆化。
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => rowHeight,
    getItemKey: (index) => rows[index]?.id ?? index,
    getScrollElement: () => scrollRef.current,
    initialRect: { width: 280, height: 320 },
    observeElementRect: (instance, callback) => {
      const element = instance.scrollElement
      if (!element) return
      const report = () => {
        const rect = element.getBoundingClientRect()
        callback({
          width: Math.round(rect.width || element.clientWidth || 280),
          height: Math.round(rect.height || element.clientHeight || 320),
        })
      }
      report()
      const Observer = instance.targetWindow?.ResizeObserver
      if (!Observer) return () => undefined
      const observer = new Observer(report)
      observer.observe(element)
      return () => observer.disconnect()
    },
    overscan: 12,
    useFlushSync: false,
  })

  const clearHover = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }, [])

  const clearAutoScroll = useCallback(() => {
    if (autoScrollRef.current !== null) cancelAnimationFrame(autoScrollRef.current)
    autoScrollRef.current = null
  }, [])

  const clearDrag = useCallback(() => {
    dragRef.current = null
    setDragging(false)
    setMoveTarget(null)
    setDragPoint(null)
    clearHover()
    clearAutoScroll()
  }, [clearAutoScroll, clearHover])

  useEffect(() => clearDrag, [clearDrag])

  const toggleExpanded = useCallback((id: string) => {
    const next = new Set(expandedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onExpandedChange?.([...next])
  }, [expandedIds, onExpandedChange])

  const focusRow = useCallback((rowIndex: number) => {
    const bounded = Math.max(0, Math.min(rows.length - 1, rowIndex))
    const row = rows[bounded]
    if (!row) return
    setFocusedId(row.id)
    virtualizer.scrollToIndex(bounded, { align: 'auto' })
    queueMicrotask(() => {
      scrollRef.current
        ?.querySelector<HTMLElement>(`[data-tree-item-id="${CSS.escape(row.id)}"]`)
        ?.focus()
    })
  }, [rows, scrollRef, virtualizer])

  const requestSelection = useCallback((
    rowIndex: number,
    event: Pick<MouseEvent, 'shiftKey' | 'metaKey' | 'ctrlKey'>,
  ) => {
    const row = rows[rowIndex]
    if (!row || adapter.isDisabled?.(row.item)) return
    let next: readonly string[]
    const toggle = selectionMode === 'multiple' && (event.metaKey || event.ctrlKey)
    if (selectionMode === 'multiple' && event.shiftKey && selectionAnchorRef.current) {
      const anchorIndex = rows.findIndex((candidate) => candidate.id === selectionAnchorRef.current)
      const start = Math.min(anchorIndex < 0 ? rowIndex : anchorIndex, rowIndex)
      const end = Math.max(anchorIndex < 0 ? rowIndex : anchorIndex, rowIndex)
      next = rows.slice(start, end + 1)
        .filter((candidate) => !adapter.isDisabled?.(candidate.item))
        .map((candidate) => candidate.id)
    } else if (toggle) {
      next = selectedIds.includes(row.id)
        ? selectedIds.filter((id) => id !== row.id)
        : [...selectedIds, row.id]
      selectionAnchorRef.current = row.id
    } else {
      next = [row.id]
      selectionAnchorRef.current = row.id
    }
    setFocusedId(row.id)
    onSelectionChange?.(next)
  }, [adapter, onSelectionChange, rows, selectedIds, selectionMode])

  const handleKeyDown = useCallback((
    event: KeyboardEvent<HTMLDivElement>,
    rowIndex: number,
  ) => {
    if (isEditableTarget(event.target)) return
    const row = rows[rowIndex]
    if (!row) return
    let handled = true
    if (event.key === 'ArrowDown') focusRow(rowIndex + 1)
    else if (event.key === 'ArrowUp') focusRow(rowIndex - 1)
    else if (event.key === 'Home') focusRow(0)
    else if (event.key === 'End') focusRow(rows.length - 1)
    else if (event.key === 'ArrowRight') {
      if (hasChildren(row, props) && !expandedSet.has(row.id)) toggleExpanded(row.id)
      else if (expandedSet.has(row.id)) focusRow(rowIndex + 1)
    } else if (event.key === 'ArrowLeft') {
      if (expandedSet.has(row.id)) toggleExpanded(row.id)
      else if (row.parentId) focusRow(rows.findIndex((candidate) => candidate.id === row.parentId))
    } else if (event.key === 'Enter') {
      onSelectionChange?.([row.id])
      onActivate?.(row.item)
    } else if (event.key === ' ' && selectionMode === 'multiple') {
      requestSelection(rowIndex, {
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
      })
    } else if (event.key === 'Escape' && dragging) {
      suppressClickRef.current = false
      clearDrag()
    } else {
      handled = false
      onItemKeyDown?.(event, row.item, rowIndex)
    }
    if (handled) event.preventDefault()
  }, [
    clearDrag,
    dragging,
    expandedSet,
    focusRow,
    onActivate,
    onItemKeyDown,
    onSelectionChange,
    props,
    requestSelection,
    rows,
    selectionMode,
    toggleExpanded,
  ])

  const resolveMoveTarget = useCallback((clientX: number, clientY: number) => {
    const session = dragRef.current
    const element = scrollRef.current
    if (!session?.dragging || !element || filter || rows.length === 0) return
    const rect = element.getBoundingClientRect()
    const height = rect.height || element.clientHeight || 320
    const contentY = Math.max(0, clientY - rect.top + element.scrollTop)
    const hoveredIndex = Math.max(0, Math.min(
      rows.length - 1,
      Math.floor(contentY / rowHeight),
    ))
    const hovered = rows[hoveredIndex]
    if (!hovered) return
    const offset = contentY - hoveredIndex * rowHeight
    const placement = offset < 4 ? 'before' : offset >= rowHeight - 4 ? 'after' : 'inside'
    let operation: TreeMoveOperation | null
    let target: MoveTarget | null
    if (placement === 'inside') {
      operation = createTreeMove({
        activeId: session.activeId,
        adapter,
        treeIndex,
        itemIds: selectedIds,
        parentId: hovered.id,
        index: adapter.getChildren(hovered.item)?.length ?? 0,
      })
      target = operation ? { operation, kind: 'inside', targetId: hovered.id } : null
    } else {
      const boundary = placement === 'after' ? hoveredIndex + 1 : hoveredIndex
      const next = rows[boundary]
      const previous = rows[boundary - 1]
      const requestedDepth = Math.max(
        1,
        session.startDepth + Math.trunc((clientX - session.startX) / INDENT),
      )
      const anchor = placement === 'before' && next ? next : previous
      if (!anchor) return
      const depth = Math.min(requestedDepth, (previous?.depth ?? 0) + 1)
      let parentId = anchor.parentId
      let index = placement === 'before' && next ? next.index : anchor.index + 1
      if (depth === (previous?.depth ?? 0) + 1 && previous) {
        parentId = previous.id
        index = adapter.getChildren(previous.item)?.length ?? 0
      } else if (depth < anchor.depth) {
        const parentAnchorId = anchor.ancestorIds[depth - 1]
        const parentAnchor = parentAnchorId ? treeIndex.get(parentAnchorId) : undefined
        if (parentAnchor) {
          parentId = parentAnchor.parentId
          index = parentAnchor.index + 1
        }
      }
      operation = createTreeMove({
        activeId: session.activeId,
        adapter,
        treeIndex,
        itemIds: selectedIds,
        parentId,
        index,
      })
      target = operation
        ? { operation, kind: 'line', depth, lineIndex: boundary }
        : null
    }
    if (target && canDrop?.(target.operation) === false) target = null
    setMoveTarget(target)

    clearHover()
    if (
      target?.kind === 'inside'
      && target.targetId
      && !expandedSet.has(target.targetId)
      && hasChildren(hovered, props)
    ) {
      hoverTimerRef.current = setTimeout(
        () => toggleExpanded(target?.targetId ?? ''),
        HOVER_EXPAND_DELAY,
      )
    }

    clearAutoScroll()
    const relativeY = clientY - rect.top
    const velocity = relativeY < AUTO_SCROLL_EDGE && element.scrollTop > 0
      ? -AUTO_SCROLL_STEP
      : relativeY > height - AUTO_SCROLL_EDGE
        && element.scrollTop < element.scrollHeight - element.clientHeight
        ? AUTO_SCROLL_STEP
        : 0
    if (velocity !== 0) {
      const tick = () => {
        const current = scrollRef.current
        const active = dragRef.current
        if (!current || !active?.dragging) {
          autoScrollRef.current = null
          return
        }
        current.scrollTop += velocity
        resolveMoveTarget(active.lastX, active.lastY)
      }
      autoScrollRef.current = requestAnimationFrame(tick)
    }
  }, [
    adapter,
    canDrop,
    clearAutoScroll,
    clearHover,
    expandedSet,
    filter,
    props,
    rowHeight,
    rows,
    scrollRef,
    selectedIds,
    toggleExpanded,
    treeIndex,
  ])

  const handlePointerDown = useCallback((
    event: PointerEvent<HTMLDivElement>,
    row: IndexedTreeItem<T>,
  ) => {
    if (
      event.button !== 0
      || filter
      || !onMove
      || adapter.canMove?.(row.item) === false
      || (event.target as HTMLElement).closest('button, input, textarea, select')
    ) return
    dragRef.current = {
      pointerId: event.pointerId,
      activeId: row.id,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startDepth: row.depth,
      dragging: false,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [adapter, filter, onMove])

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const session = dragRef.current
    if (!session || session.pointerId !== event.pointerId) return
    session.lastX = event.clientX
    session.lastY = event.clientY
    if (!session.dragging) {
      if (Math.hypot(event.clientX - session.startX, event.clientY - session.startY) < DRAG_THRESHOLD) {
        return
      }
      session.dragging = true
      suppressClickRef.current = true
      setDragging(true)
      if (!selectedIds.includes(session.activeId)) onSelectionChange?.([session.activeId])
    }
    event.preventDefault()
    setDragPoint({ x: event.clientX, y: event.clientY })
    resolveMoveTarget(event.clientX, event.clientY)
  }, [onSelectionChange, resolveMoveTarget, selectedIds])

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const session = dragRef.current
    if (!session || session.pointerId !== event.pointerId) return
    if (session.dragging && moveTarget) onMove?.(moveTarget.operation)
    clearDrag()
  }, [clearDrag, moveTarget, onMove])

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    suppressClickRef.current = false
    clearDrag()
  }, [clearDrag])

  const rootClassName = [
    'compose-tree',
    dragging ? 'compose-tree--dragging' : null,
    className,
  ].filter(Boolean).join(' ')

  const movingRows = dragRef.current
    ? [...treeIndex.values()].filter((row) => (
        selectedIds.includes(dragRef.current?.activeId ?? '')
          ? selectedIds.includes(row.id)
          : row.id === dragRef.current?.activeId
      ) && adapter.canMove?.(row.item) !== false)
    : []
  const defaultPreview = movingRows.length > 1
    ? movingRows.length
    : movingRows[0]
      ? adapter.getLabel(movingRows[0].item)
      : null
  const previewContent = renderDragPreview
    ? renderDragPreview(movingRows.map((row) => row.item), defaultPreview)
    : defaultPreview

  return (
    <div
      {...htmlProps}
      className={rootClassName}
      data-compose-theme={theme?.resolvedTheme}
      data-compose-ui="tree"
      lang={i18n?.locale ?? 'zh-CN'}
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
      } as CSSProperties}
    >
      <div
        ref={scrollRef}
        aria-label={htmlProps['aria-label']}
        className="compose-tree__scroll"
        role="treegrid"
        onContextMenu={(event) => {
          if (event.target === event.currentTarget) onBackgroundContextMenu?.(event)
        }}
        onLostPointerCapture={handlePointerCancel}
        onPointerCancel={handlePointerCancel}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className="compose-tree__virtual"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {moveTarget?.kind === 'line' ? (
            <div
              aria-hidden="true"
              className="compose-tree__drop-line"
              data-testid={dropIndicatorTestId}
              style={{
                left: INDENT_BASE + ((moveTarget.depth ?? 1) - 1) * INDENT,
                top: (moveTarget.lineIndex ?? 0) * rowHeight - 1,
              }}
            />
          ) : null}
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null
            const context = contextFor(row, props, focusedId)
            const itemAttributes = getItemAttributes?.(context) ?? {}
            const rowClassName = [
              'compose-tree__row',
              context.selected ? 'compose-tree__row--selected' : null,
              moveTarget?.kind === 'inside' && moveTarget.targetId === row.id
                ? 'compose-tree__row--drop-inside'
                : null,
              itemAttributes.className,
            ].filter(Boolean).join(' ')
            const dropTargetAttributes = moveTarget?.kind === 'inside'
              && moveTarget.targetId === row.id
              ? { [dropTargetDataAttribute]: 'inside' }
              : {}
            return (
              <div
                key={row.id}
                className="compose-tree__row-positioner"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div
                  {...itemAttributes}
                  {...dropTargetAttributes}
                  aria-expanded={context.hasChildren
                    ? (filter ? true : context.expanded)
                    : undefined}
                  aria-level={row.depth}
                  aria-posinset={row.index + 1}
                  aria-selected={context.selected}
                  aria-setsize={row.setSize}
                  className={rowClassName}
                  data-tree-item-id={row.id}
                  role="row"
                  style={{ ...itemAttributes.style, touchAction: 'none' }}
                  tabIndex={context.focused || (!focusedId && virtualRow.index === 0) ? 0 : -1}
                  onClick={(event) => {
                    // 浏览器或宿主测试工具可能在右键后补发 compatibility click。Tree 的选择只能由
                    // 主键点击或键盘触发，避免右键菜单意图落入普通选择/激活路径。
                    if (event.button !== 0) return
                    if (performance.now() < suppressClickUntilRef.current) return
                    itemAttributes.onClick?.(event)
                    if (event.defaultPrevented) return
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false
                      return
                    }
                    requestSelection(virtualRow.index, event)
                  }}
                  onContextMenu={(event) => {
                    itemAttributes.onContextMenu?.(event)
                    if (!event.defaultPrevented) onItemContextMenu?.(event, row.item)
                    // 领域层接管右键菜单时，不能再冒泡给宿主的普通区域处理器；未接管时仍保留
                    // 原生 contextmenu 行为，保持 Tree 作为通用组件的默认语义。
                    if (event.defaultPrevented) {
                      event.stopPropagation()
                      // 覆盖 contextmenu 之后可能到达的兼容 click（含 button=0）。
                      suppressClickUntilRef.current = performance.now() + 400
                    }
                  }}
                  onDoubleClick={(event) => {
                    itemAttributes.onDoubleClick?.(event)
                    onItemDoubleClick?.(event, row.item)
                    onActivate?.(row.item)
                  }}
                  onFocus={(event) => {
                    itemAttributes.onFocus?.(event)
                    setFocusedId(row.id)
                  }}
                  onKeyDown={(event) => {
                    itemAttributes.onKeyDown?.(event)
                    if (!event.defaultPrevented) handleKeyDown(event, virtualRow.index)
                  }}
                  onPointerDown={(event) => {
                    itemAttributes.onPointerDown?.(event)
                    if (!event.defaultPrevented) handlePointerDown(event, row)
                  }}
                >
                  <div className="compose-tree__cell" role="gridcell">
                    <span
                      className="compose-tree__indent"
                      style={{ width: INDENT_BASE + (row.depth - 1) * INDENT }}
                    />
                    <button
                      aria-label={context.expanded
                        ? getCollapseLabel?.(row.item) ?? defaultCollapseLabel
                        : getExpandLabel?.(row.item) ?? defaultExpandLabel}
                      className="compose-tree__chevron"
                      disabled={!context.hasChildren}
                      tabIndex={-1}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleExpanded(row.id)
                      }}
                    >
                      <svg aria-hidden="true" viewBox="0 0 16 16">
                        <path d={context.expanded ? 'm4 6 4 4 4-4' : 'm6 4 4 4-4 4'} />
                      </svg>
                    </button>
                    {renderIcon ? (
                      <span className="compose-tree__icon">{renderIcon(context)}</span>
                    ) : null}
                    <span className="compose-tree__label">
                      {renderLabel?.(context) ?? adapter.getLabel(row.item)}
                    </span>
                    {renderActions ? (
                      <span className="compose-tree__actions">{renderActions(context)}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {dragPoint && previewContent !== null && typeof document !== 'undefined'
        ? createPortal(
            <div
              aria-hidden="true"
              className={movingRows.length > 1
                ? 'compose-tree__drag-preview compose-tree__drag-preview--count'
                : 'compose-tree__drag-preview'}
              data-testid={dragPreviewTestId}
              style={{
                left: Math.max(8, Math.min(dragPoint.x + 12, window.innerWidth - 220)),
                top: Math.max(8, Math.min(dragPoint.y + 12, window.innerHeight - 48)),
              }}
            >
              {previewContent}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
