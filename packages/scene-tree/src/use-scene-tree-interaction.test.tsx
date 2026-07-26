import { act, fireEvent, renderHook } from '@testing-library/react'
import type { KeyboardEvent, MouseEvent, RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useSceneTreeInteraction } from './use-scene-tree-interaction'
import type { ComposeSceneTreeCommandController, ComposeSceneTreeNode } from './index'

const nodes: readonly ComposeSceneTreeNode[] = [{
  id: 'page',
  label: 'Page',
  children: [{ id: 'child', label: 'Child' }],
}]

function commands(): ComposeSceneTreeCommandController {
  return {
    clipboard: null,
    clearClipboard: vi.fn(),
    execute: vi.fn(),
    isEnabled: vi.fn(() => true),
  }
}

function keyboardEvent(key: string): KeyboardEvent<HTMLDivElement> {
  return {
    ctrlKey: false,
    key,
    metaKey: false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent<HTMLDivElement>
}

function mouseEvent(x = 20, y = 30): MouseEvent<HTMLDivElement> {
  return {
    clientX: x,
    clientY: y,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    shiftKey: false,
  } as unknown as MouseEvent<HTMLDivElement>
}

describe('useSceneTreeInteraction', () => {
  it('focuses a virtual row only after requesting it from the virtualizer', async () => {
    const container = document.createElement('div')
    const pageRow = document.createElement('div')
    const childRow = document.createElement('div')
    pageRow.dataset.sceneNodeId = 'page'
    childRow.dataset.sceneNodeId = 'child'
    pageRow.tabIndex = -1
    childRow.tabIndex = -1
    container.append(pageRow, childRow)
    document.body.append(container)
    const scrollToIndex = vi.fn()
    const { result, unmount } = renderHook(() => useSceneTreeInteraction({
      cancelDrag: vi.fn(),
      commands: commands(),
      expandedIds: ['page'],
      isDragging: () => false,
      nodes,
      scrollRef: { current: container } as RefObject<HTMLDivElement>,
      scrollToIndex,
      selectedIds: [],
    }))

    act(() => result.current.handleKeyDown(keyboardEvent('ArrowDown'), 0))
    await act(() => Promise.resolve())
    expect(scrollToIndex).toHaveBeenCalledWith(1)
    expect(childRow).toHaveFocus()

    unmount()
    container.remove()
  })

  it('owns search state and closes a context menu on outside pointer down', () => {
    const { result } = renderHook(() => useSceneTreeInteraction({
      cancelDrag: vi.fn(),
      commands: commands(),
      expandedIds: ['page'],
      isDragging: () => false,
      nodes,
      scrollRef: { current: null },
      scrollToIndex: vi.fn(),
      selectedIds: [],
    }))

    act(() => result.current.setQuery('Child'))
    expect(result.current.rows.map((row) => row.node.id)).toEqual(['page', 'child'])
    act(() => result.current.openContextMenu(mouseEvent(), 'child'))
    expect(result.current.contextMenu).toMatchObject({ nodeId: 'child', x: 20, y: 30 })
    fireEvent.pointerDown(document.body)
    expect(result.current.contextMenu).toBeNull()
  })
})
