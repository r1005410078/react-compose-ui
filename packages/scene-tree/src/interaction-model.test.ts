import { describe, expect, it } from 'vitest'
import {
  resolveKeyboardAction,
  resolveMenuFocusIndex,
  resolveSelection,
} from './interaction-model'
import type { IndexedSceneTreeNode } from './tree-model'

const rows: readonly IndexedSceneTreeNode[] = ['page', 'a', 'b', 'c'].map((id, index) => ({
  node: {
    id,
    label: id,
    children: id === 'a' ? [{ id: 'child', label: 'child' }] : undefined,
  },
  parentId: id === 'page' ? null : 'page',
  depth: id === 'page' ? 1 : 2,
  index,
  setSize: 4,
  ancestorIds: id === 'page' ? [] : ['page'],
}))

describe('scene tree interaction model', () => {
  it('calculates plain, toggle and range selections without DOM events', () => {
    expect(resolveSelection(rows, ['a'], 'a', 'b', {
      shiftKey: false,
      toggleKey: false,
    })).toEqual({ selectedIds: ['b'], anchorId: 'b' })
    expect(resolveSelection(rows, ['a'], 'a', 'b', {
      shiftKey: false,
      toggleKey: true,
    })).toEqual({ selectedIds: ['a', 'b'], anchorId: 'b' })
    expect(resolveSelection(rows, ['a'], 'a', 'c', {
      shiftKey: true,
      toggleKey: false,
    })).toEqual({ selectedIds: ['a', 'b', 'c'], anchorId: 'a' })
  })

  it('falls back to the target when a range anchor is no longer visible', () => {
    expect(resolveSelection(rows, ['a'], 'missing', 'c', {
      shiftKey: true,
      toggleKey: false,
    })).toEqual({ selectedIds: ['c'], anchorId: 'missing' })
  })

  it('maps navigation, commands and platform rename keys to actions', () => {
    const row = rows[1]!
    const input = {
      commandKey: false,
      expanded: false,
      isDragging: false,
      isWindows: false,
      row,
      rowCount: rows.length,
      rowIndex: 1,
    }
    expect(resolveKeyboardAction({ ...input, key: 'ArrowDown' })).toEqual({
      type: 'focus-index', index: 2,
    })
    expect(resolveKeyboardAction({ ...input, key: 'ArrowRight' })).toEqual({
      type: 'toggle-expanded', nodeId: 'a',
    })
    expect(resolveKeyboardAction({ ...input, key: 'Enter' })).toEqual({
      type: 'edit', nodeId: 'a',
    })
    expect(resolveKeyboardAction({ ...input, key: 'F2', isWindows: true })).toEqual({
      type: 'edit', nodeId: 'a',
    })
    expect(resolveKeyboardAction({ ...input, key: 'c', commandKey: true })).toEqual({
      type: 'command', command: 'copy',
    })
    expect(resolveKeyboardAction({ ...input, key: 'Escape', isDragging: true })).toEqual({
      type: 'cancel-drag',
    })
  })

  it('wraps context-menu focus while supporting Home and End', () => {
    expect(resolveMenuFocusIndex('ArrowDown', 2, 3)).toBe(0)
    expect(resolveMenuFocusIndex('ArrowUp', 0, 3)).toBe(2)
    expect(resolveMenuFocusIndex('Home', 2, 3)).toBe(0)
    expect(resolveMenuFocusIndex('End', 0, 3)).toBe(2)
    expect(resolveMenuFocusIndex('Escape', 0, 3)).toBeNull()
  })
})
