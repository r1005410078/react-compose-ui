import type { SceneTreeNode, SceneTreeOperation } from './index'

export interface IndexedSceneTreeNode {
  node: SceneTreeNode
  parentId: string | null
  depth: number
  index: number
  setSize: number
  ancestorIds: readonly string[]
}

export interface SceneTreeSearchOptions {
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
}

export interface SceneTreeSearchResult {
  rows: readonly IndexedSceneTreeNode[]
  error: string | null
}

export type SceneTreeMoveTarget = {
  operation: Extract<SceneTreeOperation, { type: 'move' }>
  depth: number
  lineIndex: number
} | {
  kind: 'inside'
  operation: Extract<SceneTreeOperation, { type: 'move' }>
  targetNodeId: string
}

export function buildTreeIndex(
  nodes: readonly SceneTreeNode[],
): ReadonlyMap<string, IndexedSceneTreeNode> {
  const index = new Map<string, IndexedSceneTreeNode>()
  const stack: Array<{
    node: SceneTreeNode
    parentId: string | null
    depth: number
    index: number
    setSize: number
    ancestorIds: readonly string[]
  }> = []

  for (let position = nodes.length - 1; position >= 0; position -= 1) {
    stack.push({
      node: nodes[position],
      parentId: null,
      depth: 1,
      index: position,
      setSize: nodes.length,
      ancestorIds: [],
    })
  }

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || index.has(current.node.id)) continue

    index.set(current.node.id, current)
    const children = current.node.children ?? []
    const ancestorIds = [...current.ancestorIds, current.node.id]
    for (let position = children.length - 1; position >= 0; position -= 1) {
      stack.push({
        node: children[position],
        parentId: current.node.id,
        depth: current.depth + 1,
        index: position,
        setSize: children.length,
        ancestorIds,
      })
    }
  }

  return index
}

export function flattenVisibleTree(
  nodes: readonly SceneTreeNode[],
  expandedIds: ReadonlySet<string>,
): readonly IndexedSceneTreeNode[] {
  const index = buildTreeIndex(nodes)
  const rows: IndexedSceneTreeNode[] = []
  const stack = [...nodes].reverse()

  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    const indexedNode = index.get(node.id)
    if (!indexedNode) continue
    rows.push(indexedNode)

    if (expandedIds.has(node.id)) {
      const children = node.children ?? []
      for (let position = children.length - 1; position >= 0; position -= 1) {
        stack.push(children[position])
      }
    }
  }

  return rows
}

export function searchTree(
  nodes: readonly SceneTreeNode[],
  query: string,
  options: SceneTreeSearchOptions,
): SceneTreeSearchResult {
  const index = buildTreeIndex(nodes)
  const allRows = [...index.values()]
  if (query.length === 0) return { rows: allRows, error: null }

  const flags = `${options.caseSensitive ? '' : 'i'}u`
  if (options.regex) {
    try {
      new RegExp(query, flags)
    } catch {
      return { rows: [], error: '正则表达式无效' }
    }
  }

  let expression = options.regex
    ? query
    : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (options.wholeWord) {
    expression = `(?<![\\p{L}\\p{N}_])(?:${expression})(?![\\p{L}\\p{N}_])`
  }

  let matcher: RegExp
  try {
    matcher = new RegExp(expression, flags)
  } catch {
    return { rows: [], error: '正则表达式无效' }
  }

  const includedIds = new Set<string>()
  for (const row of allRows) {
    if (matcher.test(row.node.label)) {
      includedIds.add(row.node.id)
      for (const ancestorId of row.ancestorIds) includedIds.add(ancestorId)
    }
  }

  return {
    rows: allRows.filter((row) => includedIds.has(row.node.id)),
    error: null,
  }
}

export function getMovingNodeIds(
  index: ReadonlyMap<string, IndexedSceneTreeNode>,
  rows: readonly IndexedSceneTreeNode[],
  selectedIds: readonly string[],
  activeId: string,
): readonly string[] {
  const requestedIds = selectedIds.includes(activeId) ? selectedIds : [activeId]
  const requestedSet = new Set(requestedIds)
  const movableIds = rows
    .filter((row) => requestedSet.has(row.node.id))
    .filter((row) => row.node.canMove !== false && !row.node.locked)
    .map((row) => row.node.id)
  const movableSet = new Set(movableIds)

  return movableIds.filter((nodeId) => {
    const row = index.get(nodeId)
    return row && !row.ancestorIds.some((ancestorId) => movableSet.has(ancestorId))
  })
}

export function createMoveTarget(
  index: ReadonlyMap<string, IndexedSceneTreeNode>,
  rows: readonly IndexedSceneTreeNode[],
  selectedIds: readonly string[],
  activeId: string,
  boundaryIndex: number,
  requestedDepth: number,
  placement: 'before' | 'inside' | 'after' = 'after',
): SceneTreeMoveTarget | null {
  const movingIds = getMovingNodeIds(index, rows, selectedIds, activeId)
  if (movingIds.length === 0) return null

  if (placement === 'inside') {
    const target = rows[boundaryIndex]
    if (!target || !isValidMoveParent(index, movingIds, target.node.id)) return null
    const operation = {
      type: 'move' as const,
      nodeIds: movingIds,
      parentId: target.node.id,
      index: target.node.children?.length ?? 0,
    }
    if (isMoveNoOp(index, operation)) return null
    return {
      kind: 'inside',
      operation,
      targetNodeId: target.node.id,
    }
  }

  if (boundaryIndex <= 0) {
    const operation = {
      type: 'move' as const,
      nodeIds: movingIds,
      parentId: null,
      index: 0,
    }
    return isMoveNoOp(index, operation) ? null : { operation, depth: 1, lineIndex: 0 }
  }

  const previous = rows[Math.min(boundaryIndex, rows.length) - 1]
  const next = rows[boundaryIndex]
  const requestedIntegerDepth = Math.max(1, Math.floor(requestedDepth))
  if (
    placement === 'after'
    && previous
    && next?.parentId === previous.node.id
    && requestedIntegerDepth <= previous.depth
  ) {
    if (!isValidMoveParent(index, movingIds, previous.node.id)) return null
    const operation = {
      type: 'move' as const,
      nodeIds: movingIds,
      parentId: previous.node.id,
      index: next.index,
    }
    if (isMoveNoOp(index, operation)) return null
    return {
      operation,
      depth: next.depth,
      lineIndex: boundaryIndex,
    }
  }

  if (placement === 'before' && next && requestedIntegerDepth === next.depth) {
    if (movingIds.includes(next.node.id)) return null
    const parentId = next.parentId
    if (!isValidMoveParent(index, movingIds, parentId)) return null
    const operation = {
      type: 'move' as const,
      nodeIds: movingIds,
      parentId,
      index: next.index,
    }
    if (isMoveNoOp(index, operation)) return null
    return {
      operation,
      depth: next.depth,
      lineIndex: boundaryIndex,
    }
  }

  if (!previous) return null
  const depth = Math.min(requestedIntegerDepth, previous.depth + 1)

  let anchor = previous
  let parentId: string | null
  let targetIndex: number
  if (depth === previous.depth + 1) {
    if (previous.node.canHaveChildren === false || previous.node.locked) return null
    parentId = previous.node.id
    targetIndex = previous.node.children?.length ?? 0
  } else {
    const anchorId = depth === previous.depth
      ? previous.node.id
      : previous.ancestorIds[depth - 1]
    const resolvedAnchor = anchorId ? index.get(anchorId) : undefined
    if (!resolvedAnchor) return null
    anchor = resolvedAnchor
    parentId = anchor.parentId
    targetIndex = anchor.index + 1
  }

  if (movingIds.includes(anchor.node.id)) return null
  if (!isValidMoveParent(index, movingIds, parentId)) return null

  const operation = {
    type: 'move' as const,
    nodeIds: movingIds,
    parentId,
    index: targetIndex,
  }
  if (isMoveNoOp(index, operation)) return null

  return {
    operation,
    depth,
    lineIndex: findVisibleSubtreeEnd(rows, anchor.node.id),
  }
}

function isValidMoveParent(
  index: ReadonlyMap<string, IndexedSceneTreeNode>,
  movingIds: readonly string[],
  parentId: string | null,
): boolean {
  if (!parentId) return true
  const parent = index.get(parentId)
  return Boolean(
    parent
    && parent.node.canHaveChildren !== false
    && !parent.node.locked
    && !movingIds.includes(parentId)
    && !parent.ancestorIds.some((ancestorId) => movingIds.includes(ancestorId)),
  )
}

function findVisibleSubtreeEnd(
  rows: readonly IndexedSceneTreeNode[],
  anchorId: string,
): number {
  const anchorIndex = rows.findIndex((row) => row.node.id === anchorId)
  if (anchorIndex < 0) return rows.length
  const anchorDepth = rows[anchorIndex]?.depth ?? 1
  let lineIndex = anchorIndex + 1
  while (lineIndex < rows.length && (rows[lineIndex]?.depth ?? 0) > anchorDepth) {
    lineIndex += 1
  }
  return lineIndex
}

function isMoveNoOp(
  index: ReadonlyMap<string, IndexedSceneTreeNode>,
  operation: Extract<SceneTreeOperation, { type: 'move' }>,
): boolean {
  if (operation.nodeIds.some((nodeId) => index.get(nodeId)?.parentId !== operation.parentId)) {
    return false
  }

  const siblings = [...index.values()]
    .filter((row) => row.parentId === operation.parentId)
    .sort((left, right) => left.index - right.index)
    .map((row) => row.node.id)
  const movingSet = new Set(operation.nodeIds)
  const removedBeforeTarget = siblings
    .slice(0, operation.index)
    .filter((nodeId) => movingSet.has(nodeId))
    .length
  const remaining = siblings.filter((nodeId) => !movingSet.has(nodeId))
  const insertionIndex = Math.max(
    0,
    Math.min(remaining.length, operation.index - removedBeforeTarget),
  )
  const reordered = [...remaining]
  reordered.splice(insertionIndex, 0, ...operation.nodeIds)
  return reordered.every((nodeId, position) => nodeId === siblings[position])
}
