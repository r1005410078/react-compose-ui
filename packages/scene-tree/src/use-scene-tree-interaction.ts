import { useCallback, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, RefObject } from 'react'
import { useComposeContextMenu } from '@compose-ui/components'
import type { ComposeSceneTreeNode, ComposeSceneTreeOperation, ComposeSceneTreeCommandController } from './index'
import { resolveKeyboardAction, resolveSelection } from './interaction-model'
import { buildTreeIndex, flattenVisibleTree, searchTree } from './tree-model'

interface UseSceneTreeInteractionOptions {
  cancelDrag: () => void
  commands: ComposeSceneTreeCommandController
  expandedIds: readonly string[]
  isDragging: () => boolean
  nodes: readonly ComposeSceneTreeNode[]
  onExpandedChange?: (nodeIds: readonly string[]) => void
  onOperation?: (operation: ComposeSceneTreeOperation) => void
  onSelectionChange?: (nodeIds: readonly string[]) => void
  scrollRef: RefObject<HTMLDivElement | null>
  scrollToIndex: (rowIndex: number) => void
  selectedIds: readonly string[]
}

function isWindowsPlatform() {
  if (typeof navigator === 'undefined') return false
  return /^Win/i.test(navigator.platform) || /Windows/i.test(navigator.userAgent)
}

/** 管理场景树中与 Pointer 拖拽无关的受控交互和 DOM 焦点副作用。 */
export function useSceneTreeInteraction({
  cancelDrag,
  commands,
  expandedIds,
  isDragging,
  nodes,
  onExpandedChange,
  onOperation,
  onSelectionChange,
  scrollRef,
  scrollToIndex,
  selectedIds,
}: UseSceneTreeInteractionOptions) {
  const selectionAnchorRef = useRef<string | null>(selectedIds[selectedIds.length - 1] ?? null)
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [regex, setRegex] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(selectedIds[selectedIds.length - 1] ?? null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const contextMenu = useComposeContextMenu<string | null>()
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

  const requestSelection = useCallback((nodeId: string, event: MouseEvent) => {
    const result = resolveSelection(
      rows,
      selectedIds,
      selectionAnchorRef.current,
      nodeId,
      { shiftKey: event.shiftKey, toggleKey: event.metaKey || event.ctrlKey },
    )
    selectionAnchorRef.current = result.anchorId
    setFocusedId(nodeId)
    onSelectionChange?.(result.selectedIds)
  }, [onSelectionChange, rows, selectedIds])

  const toggleExpanded = useCallback((nodeId: string) => {
    const next = new Set(expandedIds)
    if (next.has(nodeId)) next.delete(nodeId)
    else next.add(nodeId)
    onExpandedChange?.([...next])
  }, [expandedIds, onExpandedChange])

  const focusRow = useCallback((rowIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(rows.length - 1, rowIndex))
    const row = rows[boundedIndex]
    if (!row) return
    setFocusedId(row.node.id)
    scrollToIndex(boundedIndex)
    queueMicrotask(() => {
      const rowElement = [...(scrollRef.current
        ?.querySelectorAll<HTMLElement>('[data-scene-node-id]') ?? [])]
        .find((element) => element.dataset.sceneNodeId === row.node.id)
      rowElement?.focus()
    })
  }, [rows, scrollRef, scrollToIndex])

  const handleKeyDown = useCallback((event: KeyboardEvent, rowIndex: number) => {
    const row = rows[rowIndex]
    if (!row) return
    const action = resolveKeyboardAction({
      key: event.key,
      commandKey: event.metaKey || event.ctrlKey,
      isWindows: isWindowsPlatform(),
      isDragging: isDragging(),
      rowIndex,
      rowCount: rows.length,
      row,
      expanded: expandedSet.has(row.node.id),
    })
    if (!action) return
    if (action.type === 'cancel-drag') cancelDrag()
    else if (action.type === 'command') commands.execute(action.command, row.node.id)
    else if (action.type === 'focus-index') focusRow(action.index)
    else if (action.type === 'focus-parent') {
      focusRow(rows.findIndex((candidate) => candidate.node.id === action.parentId))
    } else if (action.type === 'toggle-expanded') toggleExpanded(action.nodeId)
    else if (action.type === 'select') onSelectionChange?.([action.nodeId])
    else if (action.type === 'edit') setEditingId(action.nodeId)
    event.preventDefault()
  }, [cancelDrag, commands, expandedSet, focusRow, isDragging, onSelectionChange, rows, toggleExpanded])

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
      contextMenu.close()
      if (nodeId) requestSelection(nodeId, event)
      return
    }
    if (nodeId && !selectedIds.includes(nodeId)) onSelectionChange?.([nodeId])
    contextMenu.openAt(event, nodeId)
  }, [contextMenu, onSelectionChange, requestSelection, selectedIds])

  return {
    caseSensitive,
    commitRename,
    contextMenu,
    editingId,
    focusedId,
    handleKeyDown,
    index,
    openContextMenu,
    query,
    regex,
    requestSelection,
    rows,
    searchResult,
    setCaseSensitive,
    setEditingId,
    setFocusedId,
    setQuery,
    setRegex,
    setWholeWord,
    toggleExpanded,
    wholeWord,
  }
}
