import { useCallback, useMemo, useState } from 'react'
import { buildTreeIndex } from './tree-model'
import type {
  IndexedSceneTreeNode,
} from './tree-model'
import type {
  SceneTreeClipboard,
  SceneTreeCommand,
  SceneTreeCommandController,
  UseSceneTreeCommandsOptions,
} from './index'

interface InsertionPoint {
  parentId: string | null
  index: number
}

function normalizeIds(
  index: ReadonlyMap<string, IndexedSceneTreeNode>,
  requestedIds: readonly string[],
  predicate: (row: IndexedSceneTreeNode) => boolean,
): readonly string[] {
  const requested = new Set(requestedIds)
  const eligible = [...index.values()].filter((row) => requested.has(row.node.id) && predicate(row))
  const eligibleSet = new Set(eligible.map((row) => row.node.id))
  return eligible
    .filter((row) => !row.ancestorIds.some((ancestorId) => eligibleSet.has(ancestorId)))
    .map((row) => row.node.id)
}

function validParent(index: ReadonlyMap<string, IndexedSceneTreeNode>, parentId: string | null) {
  if (parentId === null) return true
  const parent = index.get(parentId)?.node
  return Boolean(parent && !parent.locked && parent.canHaveChildren !== false)
}

function insertionFor(
  command: SceneTreeCommand,
  targetId: string | null,
  index: ReadonlyMap<string, IndexedSceneTreeNode>,
  rootSize: number,
): InsertionPoint | null {
  if (command === 'create-root' || command === 'paste-root') {
    return { parentId: null, index: rootSize }
  }
  if (targetId === null) {
    return command === 'create-suggested' || command === 'paste-suggested'
      ? { parentId: null, index: rootSize }
      : null
  }
  const target = index.get(targetId)
  if (!target) return null
  if (command === 'create-child' || command === 'paste-child') {
    return validParent(index, targetId)
      ? { parentId: targetId, index: target.node.children?.length ?? 0 }
      : null
  }
  if (command === 'create-sibling' || command === 'paste-sibling') {
    return validParent(index, target.parentId)
      ? { parentId: target.parentId, index: target.index + 1 }
      : null
  }
  if (command === 'create-suggested' || command === 'paste-suggested') {
    if (validParent(index, targetId)) {
      return { parentId: targetId, index: target.node.children?.length ?? 0 }
    }
    return validParent(index, target.parentId)
      ? { parentId: target.parentId, index: target.index + 1 }
      : null
  }
  return null
}

function isInvalidCutTarget(
  index: ReadonlyMap<string, IndexedSceneTreeNode>,
  nodeIds: readonly string[],
  insertion: InsertionPoint,
) {
  if (!validParent(index, insertion.parentId)) return true
  if (insertion.parentId) {
    const parent = index.get(insertion.parentId)
    if (!parent || nodeIds.includes(insertion.parentId)) return true
    if (parent.ancestorIds.some((ancestorId) => nodeIds.includes(ancestorId))) return true
  }
  if (nodeIds.some((nodeId) => !index.has(nodeId))) return true

  if (nodeIds.some((nodeId) => index.get(nodeId)?.parentId !== insertion.parentId)) return false
  const siblings = [...index.values()]
    .filter((row) => row.parentId === insertion.parentId)
    .sort((left, right) => left.index - right.index)
    .map((row) => row.node.id)
  const moving = new Set(nodeIds)
  const removedBefore = siblings.slice(0, insertion.index).filter((id) => moving.has(id)).length
  const remaining = siblings.filter((id) => !moving.has(id))
  const at = Math.max(0, Math.min(remaining.length, insertion.index - removedBefore))
  remaining.splice(at, 0, ...nodeIds)
  return remaining.every((id, position) => id === siblings[position])
}

export function useSceneTreeCommands({
  nodes,
  selectedIds,
  onOperation,
}: UseSceneTreeCommandsOptions): SceneTreeCommandController {
  const [clipboard, setClipboard] = useState<SceneTreeClipboard | null>(null)
  const index = useMemo(() => buildTreeIndex(nodes), [nodes])
  const selectedTarget = selectedIds[selectedIds.length - 1] ?? null

  const normalizedSelection = useCallback((
    kind: 'copy' | 'cut' | 'delete',
    targetId?: string | null,
  ) => {
    const requestedIds = targetId !== undefined
      && targetId !== null
      && !selectedIds.includes(targetId)
      ? [targetId]
      : selectedIds
    return normalizeIds(index, requestedIds, ({ node }) => {
      if (kind === 'copy') return true
      if (kind === 'cut') return !node.locked && node.canMove !== false
      return !node.locked && node.canDelete !== false
    })
  }, [index, selectedIds])

  const resolve = useCallback((
    command: SceneTreeCommand,
    targetId: string | null | undefined,
  ): { insertion: InsertionPoint | null; sourceIds: readonly string[] } => {
    const target = targetId === undefined ? selectedTarget : targetId
    const insertion = insertionFor(command, target, index, nodes.length)
    if (!clipboard) return { insertion, sourceIds: [] }
    const sourceIds = normalizeIds(index, clipboard.nodeIds, ({ node }) => (
      clipboard.kind === 'copy' || (!node.locked && node.canMove !== false)
    ))
    if (sourceIds.length !== clipboard.nodeIds.length) return { insertion, sourceIds: [] }
    return { insertion, sourceIds }
  }, [clipboard, index, nodes.length, selectedTarget])

  const isEnabled = useCallback((command: SceneTreeCommand, targetId?: string | null) => {
    if (command === 'copy') return normalizedSelection('copy', targetId).length > 0
    if (command === 'cut') return normalizedSelection('cut', targetId).length > 0
    if (command === 'delete') return normalizedSelection('delete', targetId).length > 0
    if (command.startsWith('create-')) {
      return insertionFor(command, targetId === undefined ? selectedTarget : targetId, index, nodes.length) !== null
    }
    const { insertion, sourceIds } = resolve(command, targetId)
    if (!clipboard || !insertion || sourceIds.length === 0) return false
    return clipboard.kind === 'copy' || !isInvalidCutTarget(index, sourceIds, insertion)
  }, [clipboard, index, nodes.length, normalizedSelection, resolve, selectedTarget])

  const execute = useCallback((command: SceneTreeCommand, targetId?: string | null) => {
    if (command === 'copy' || command === 'cut') {
      const nodeIds = normalizedSelection(command, targetId)
      if (nodeIds.length > 0) setClipboard({ kind: command, nodeIds })
      return
    }
    if (command === 'delete') {
      const nodeIds = normalizedSelection('delete', targetId)
      if (nodeIds.length > 0) onOperation?.({ type: 'delete', nodeIds })
      return
    }
    if (command.startsWith('create-')) {
      const insertion = insertionFor(
        command,
        targetId === undefined ? selectedTarget : targetId,
        index,
        nodes.length,
      )
      if (insertion) onOperation?.({ type: 'create', ...insertion })
      return
    }
    const { insertion, sourceIds } = resolve(command, targetId)
    if (!clipboard || !insertion || sourceIds.length === 0) return
    if (clipboard.kind === 'copy') {
      onOperation?.({ type: 'duplicate', sourceNodeIds: sourceIds, ...insertion })
      return
    }
    if (isInvalidCutTarget(index, sourceIds, insertion)) return
    onOperation?.({ type: 'move', nodeIds: sourceIds, ...insertion })
    setClipboard(null)
  }, [clipboard, index, nodes.length, normalizedSelection, onOperation, resolve, selectedTarget])

  const clearClipboard = useCallback(() => setClipboard(null), [])
  return useMemo(() => ({ clipboard, isEnabled, execute, clearClipboard }), [
    clearClipboard,
    clipboard,
    execute,
    isEnabled,
  ])
}
