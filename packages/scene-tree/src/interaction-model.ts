import type { ComposeSceneTreeCommand } from './index'
import type { IndexedSceneTreeNode } from './tree-model'

export interface SelectionModifiers {
  shiftKey: boolean
  toggleKey: boolean
}

export interface SelectionResult {
  selectedIds: readonly string[]
  anchorId: string | null
}

export type SceneTreeKeyboardAction =
  | { type: 'command'; command: ComposeSceneTreeCommand }
  | { type: 'focus-index'; index: number }
  | { type: 'focus-parent'; parentId: string }
  | { type: 'toggle-expanded'; nodeId: string }
  | { type: 'select'; nodeId: string }
  | { type: 'edit'; nodeId: string }
  | { type: 'cancel-drag' }
  | null

export interface KeyboardActionInput {
  key: string
  commandKey: boolean
  isWindows: boolean
  isDragging: boolean
  rowIndex: number
  rowCount: number
  row: IndexedSceneTreeNode
  expanded: boolean
}

/** 将受控选择、选择锚点和修饰键解析为下一次完整选择。 */
export function resolveSelection(
  rows: readonly IndexedSceneTreeNode[],
  selectedIds: readonly string[],
  anchorId: string | null,
  nodeId: string,
  modifiers: SelectionModifiers,
): SelectionResult {
  if (modifiers.shiftKey && anchorId) {
    const anchorIndex = rows.findIndex((row) => row.node.id === anchorId)
    const nodeIndex = rows.findIndex((row) => row.node.id === nodeId)
    if (anchorIndex >= 0 && nodeIndex >= 0) {
      const start = Math.min(anchorIndex, nodeIndex)
      const end = Math.max(anchorIndex, nodeIndex)
      return {
        selectedIds: rows.slice(start, end + 1).map((row) => row.node.id),
        anchorId,
      }
    }
    return { selectedIds: [nodeId], anchorId }
  }
  if (modifiers.toggleKey) {
    return {
      selectedIds: selectedIds.includes(nodeId)
        ? selectedIds.filter((id) => id !== nodeId)
        : [...selectedIds, nodeId],
      anchorId: nodeId,
    }
  }
  return { selectedIds: [nodeId], anchorId: nodeId }
}

/** 将平台相关按键解析为不依赖 DOM 的场景树动作。 */
export function resolveKeyboardAction({
  key,
  commandKey,
  isWindows,
  isDragging,
  rowIndex,
  rowCount,
  row,
  expanded,
}: KeyboardActionInput): SceneTreeKeyboardAction {
  if (key === 'Escape' && isDragging) return { type: 'cancel-drag' }
  if (commandKey) {
    const command = ({ c: 'copy', x: 'cut', v: 'paste-suggested' } as const)[key.toLowerCase() as 'c' | 'x' | 'v']
    if (command) return { type: 'command', command }
  }
  if (key === 'ArrowDown') return { type: 'focus-index', index: rowIndex + 1 }
  if (key === 'ArrowUp') return { type: 'focus-index', index: rowIndex - 1 }
  if (key === 'Home') return { type: 'focus-index', index: 0 }
  if (key === 'End') return { type: 'focus-index', index: rowCount - 1 }
  if (key === 'ArrowRight') {
    if ((row.node.children?.length ?? 0) > 0 && !expanded) {
      return { type: 'toggle-expanded', nodeId: row.node.id }
    }
    return { type: 'focus-index', index: rowIndex + 1 }
  }
  if (key === 'ArrowLeft') {
    if (expanded) return { type: 'toggle-expanded', nodeId: row.node.id }
    return row.parentId ? { type: 'focus-parent', parentId: row.parentId } : null
  }
  const canRename = !row.node.locked && row.node.canRename !== false
  if (key === 'Enter' && !isWindows && canRename) return { type: 'edit', nodeId: row.node.id }
  if (key === ' ' || (key === 'Enter' && isWindows)) return { type: 'select', nodeId: row.node.id }
  if (key === 'F2' && isWindows && canRename) return { type: 'edit', nodeId: row.node.id }
  if (key === 'Delete') return { type: 'command', command: 'delete' }
  return null
}

/** 计算右键菜单中下一个获得焦点的可用项索引。 */
export function resolveMenuFocusIndex(
  key: string,
  currentIndex: number,
  itemCount: number,
): number | null {
  if (itemCount === 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return itemCount - 1
  if (key === 'ArrowDown') return (currentIndex + 1) % itemCount
  if (key === 'ArrowUp') return (currentIndex - 1 + itemCount) % itemCount
  return null
}
