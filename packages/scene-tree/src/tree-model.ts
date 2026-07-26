import type { ComposeSceneTreeNode, ComposeSceneTreeOperation } from './index'

export interface IndexedSceneTreeNode {
  node: ComposeSceneTreeNode
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
  operation: Extract<ComposeSceneTreeOperation, { type: 'move' }>
  depth: number
  lineIndex: number
} | {
  kind: 'inside'
  operation: Extract<ComposeSceneTreeOperation, { type: 'move' }>
  targetNodeId: string
}

/**
 * 将嵌套节点转换为包含父级、深度和 ARIA 位置信息的索引。
 *
 * @remarks
 * 使用显式栈而不是递归，避免极深场景树耗尽调用栈。遇到重复 ID 时保留第一次出现的节点，
 * 因为组件要求 ID 在树实例内稳定且唯一。
 */
export function buildTreeIndex(
  nodes: readonly ComposeSceneTreeNode[],
): ReadonlyMap<string, IndexedSceneTreeNode> {
  const index = new Map<string, IndexedSceneTreeNode>()
  const stack: Array<{
    node: ComposeSceneTreeNode
    parentId: string | null
    depth: number
    index: number
    setSize: number
    ancestorIds: readonly string[]
  }> = []

  // 逆序入栈让出栈顺序仍与宿主提供的树顺序一致。
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

/**
 * 按树顺序生成当前展开状态下的可见行。
 *
 * @remarks
 * 返回结果是虚拟列表和 Shift 范围选择共同使用的顺序基准。
 */
export function flattenVisibleTree(
  nodes: readonly ComposeSceneTreeNode[],
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

/**
 * 检索匹配节点，并保留所有匹配节点的祖先以维持可理解的树路径。
 *
 * @returns 可展示行以及用户可访问的正则错误；无匹配不是错误。
 */
export function searchTree(
  nodes: readonly ComposeSceneTreeNode[],
  query: string,
  options: SceneTreeSearchOptions,
): SceneTreeSearchResult {
  const index = buildTreeIndex(nodes)
  const allRows = [...index.values()]
  if (query.length === 0) return { rows: allRows, error: null }

  const flags = `${options.caseSensitive ? '' : 'i'}u`
  if (options.regex) {
    // 必须先验证用户原始表达式，否则全词包装可能掩盖原表达式的语法错误。
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

/**
 * 规范化一次拖拽实际移动的顶层节点。
 *
 * @remarks
 * 拖动已选节点时沿用整个可见选择，拖动未选节点时只使用活动节点。锁定或禁止移动的节点
 * 会被过滤；祖先与后代同时入选时只保留祖先，避免同一子树被移动两次。
 */
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

/**
 * 将指针命中位置和横向缩进换算为最终的受控 `move` 操作。
 *
 * @remarks
 * `before`、`inside`、`after` 对应顶部横线、父级高亮和底部横线。返回 `null` 表示目标非法
 * 或移动不会改变树，因此 UI 不应显示有效落点。
 */
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
  // 展开节点后的第一条可见行属于其子树；落在父节点底边时必须插入为首个子项，不能把横线
  // 推到整个可见子树末尾。
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

/** 拒绝锁定父级，以及会把节点移入自身或其后代的循环结构。 */
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

/** 返回锚点完整可见子树之后的边界行索引。 */
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

/**
 * 比较移除再插入后的兄弟顺序，用于抑制不会产生任何结构变化的 move。
 */
function isMoveNoOp(
  index: ReadonlyMap<string, IndexedSceneTreeNode>,
  operation: Extract<ComposeSceneTreeOperation, { type: 'move' }>,
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
