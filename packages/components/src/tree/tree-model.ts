import type { TreeItemAdapter, TreeMoveOperation } from './tree-types'

/**
 * Tree 的迭代索引行。
 *
 * @typeParam T - 宿主业务节点类型。
 * @public
 */
export interface IndexedTreeItem<T> {
  readonly id: string
  readonly item: T
  readonly parentId: string | null
  readonly depth: number
  readonly index: number
  readonly setSize: number
  readonly ancestorIds: readonly string[]
}

/**
 * 迭代建立树索引，避免深层业务数据耗尽调用栈。
 *
 * @public
 */
export function createTreeIndex<T>(
  items: readonly T[],
  adapter: TreeItemAdapter<T>,
): ReadonlyMap<string, IndexedTreeItem<T>> {
  const result = new Map<string, IndexedTreeItem<T>>()
  const stack: Array<IndexedTreeItem<T>> = []
  for (let position = items.length - 1; position >= 0; position -= 1) {
    const item = items[position]
    if (!item) continue
    stack.push({
      id: adapter.getId(item),
      item,
      parentId: null,
      depth: 1,
      index: position,
      setSize: items.length,
      ancestorIds: [],
    })
  }
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || result.has(current.id)) continue
    result.set(current.id, current)
    const children = adapter.getChildren(current.item) ?? []
    const ancestors = [...current.ancestorIds, current.id]
    for (let position = children.length - 1; position >= 0; position -= 1) {
      const child = children[position]
      if (!child) continue
      stack.push({
        id: adapter.getId(child),
        item: child,
        parentId: current.id,
        depth: current.depth + 1,
        index: position,
        setSize: children.length,
        ancestorIds: ancestors,
      })
    }
  }
  return result
}

/**
 * 按展开与过滤状态返回虚拟列表可见行。
 *
 * @public
 */
export function flattenTree<T>(
  items: readonly T[],
  adapter: TreeItemAdapter<T>,
  options: {
    readonly expandedIds: ReadonlySet<string>
    readonly filter?: (item: T) => boolean
  },
): readonly IndexedTreeItem<T>[] {
  const treeIndex = createTreeIndex(items, adapter)
  const includedIds = options.filter
    ? collectFilteredIds(treeIndex, options.filter)
    : null
  const rows: IndexedTreeItem<T>[] = []
  const stack = [...items].reverse()
  while (stack.length > 0) {
    const item = stack.pop()
    if (!item) continue
    const id = adapter.getId(item)
    const row = treeIndex.get(id)
    if (!row || (includedIds && !includedIds.has(id))) continue
    rows.push(row)
    const shouldExpand = includedIds !== null || options.expandedIds.has(id)
    if (!shouldExpand) continue
    const children = adapter.getChildren(item) ?? []
    for (let position = children.length - 1; position >= 0; position -= 1) {
      const child = children[position]
      if (child) stack.push(child)
    }
  }
  return rows
}

function collectFilteredIds<T>(
  treeIndex: ReadonlyMap<string, IndexedTreeItem<T>>,
  filter: (item: T) => boolean,
) {
  const ids = new Set<string>()
  for (const row of treeIndex.values()) {
    if (!filter(row.item)) continue
    ids.add(row.id)
    for (const ancestorId of row.ancestorIds) ids.add(ancestorId)
  }
  return ids
}

/**
 * 规范化并校验 Tree 移动意图。
 *
 * @returns 合法且非 noop 的移动；循环、叶目标或无变化返回 `null`。
 * @public
 */
export function createTreeMove<T>(input: {
  readonly activeId: string
  readonly adapter: TreeItemAdapter<T>
  readonly treeIndex: ReadonlyMap<string, IndexedTreeItem<T>>
  readonly itemIds: readonly string[]
  readonly parentId: string | null
  readonly index: number
}): TreeMoveOperation | null {
  const requested = input.itemIds.includes(input.activeId)
    ? new Set(input.itemIds)
    : new Set([input.activeId])
  const candidates = [...input.treeIndex.values()]
    .filter((row) => requested.has(row.id))
    .filter((row) => input.adapter.canMove?.(row.item) !== false)
  const candidateIds = new Set(candidates.map((row) => row.id))
  const itemIds = candidates
    .filter((row) => !row.ancestorIds.some((ancestorId) => candidateIds.has(ancestorId)))
    .map((row) => row.id)
  if (itemIds.length === 0) return null

  if (input.parentId !== null) {
    const parent = input.treeIndex.get(input.parentId)
    if (
      !parent
      || input.adapter.canHaveChildren?.(parent.item) === false
      || itemIds.includes(parent.id)
      || parent.ancestorIds.some((ancestorId) => itemIds.includes(ancestorId))
    ) return null
  }

  const siblings = [...input.treeIndex.values()]
    .filter((row) => row.parentId === input.parentId)
    .sort((left, right) => left.index - right.index)
    .map((row) => row.id)
  const moving = new Set(itemIds)
  const removedBefore = siblings
    .slice(0, input.index)
    .filter((id) => moving.has(id))
    .length
  const remaining = siblings.filter((id) => !moving.has(id))
  const insertionIndex = Math.max(
    0,
    Math.min(remaining.length, input.index - removedBefore),
  )
  const reordered = [...remaining]
  reordered.splice(insertionIndex, 0, ...itemIds)
  if (
    itemIds.every((id) => input.treeIndex.get(id)?.parentId === input.parentId)
    && reordered.length === siblings.length
    && reordered.every((id, position) => id === siblings[position])
  ) return null

  return {
    itemIds,
    parentId: input.parentId,
    index: Math.max(0, input.index - removedBefore),
  }
}
