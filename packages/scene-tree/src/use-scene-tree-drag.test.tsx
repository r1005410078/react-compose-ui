import { act, renderHook } from '@testing-library/react'
import type { PointerEvent, RefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTreeIndex, flattenVisibleTree } from './tree-model'
import { useSceneTreeDrag } from './use-scene-tree-drag'
import type { SceneTreeNode } from './index'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function pointerEvent(
  type: 'down' | 'move' | 'cancel',
  x: number,
  y: number,
  setPointerCapture = vi.fn(),
): PointerEvent<HTMLDivElement> {
  const target = document.createElement('div')
  return {
    button: 0,
    clientX: x,
    clientY: y,
    currentTarget: { setPointerCapture },
    pointerId: 1,
    preventDefault: vi.fn(),
    target,
    type,
  } as unknown as PointerEvent<HTMLDivElement>
}

function scrollRef(height = 240, scrollHeight = 480): RefObject<HTMLDivElement> {
  const element = document.createElement('div')
  Object.defineProperties(element, {
    clientHeight: { value: height },
    scrollHeight: { value: scrollHeight },
  })
  element.getBoundingClientRect = () => ({
    bottom: height,
    height,
    left: 0,
    right: 280,
    top: 0,
    width: 280,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
  return { current: element }
}

describe('useSceneTreeDrag', () => {
  it('captures the pointer and expands a valid parent after 600ms', async () => {
    vi.useFakeTimers()
    const nodes: readonly SceneTreeNode[] = [
      { id: 'folder', label: 'Folder', children: [{ id: 'child', label: 'Child' }] },
      { id: 'loose', label: 'Loose', canHaveChildren: false },
    ]
    const rows = flattenVisibleTree(nodes, new Set())
    const onExpandedChange = vi.fn()
    const capture = vi.fn()
    const { result } = renderHook(() => useSceneTreeDrag({
      expandedIds: [],
      index: buildTreeIndex(nodes),
      onExpandedChange,
      query: '',
      rows,
      scrollRef: scrollRef(),
      selectedIds: ['loose'],
    }))

    act(() => result.current.handlePointerDown(pointerEvent('down', 14, 36, capture), 'loose'))
    expect(capture).toHaveBeenCalledWith(1)
    act(() => result.current.handlePointerMove(pointerEvent('move', 30, 12)))
    await act(() => vi.advanceTimersByTimeAsync(600))

    expect(onExpandedChange).toHaveBeenCalledWith(['folder'])
    expect(result.current.dragPreview).toMatchObject({ label: 'Loose' })
  })

  it('cancels drag feedback and pending animation frames on cleanup', () => {
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7)
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const nodes = Array.from({ length: 30 }, (_, index) => ({
      id: `node-${index}`,
      label: `Node ${index}`,
    }))
    const rows = flattenVisibleTree(nodes, new Set())
    const { result, unmount } = renderHook(() => useSceneTreeDrag({
      expandedIds: [],
      index: buildTreeIndex(nodes),
      query: '',
      rows,
      scrollRef: scrollRef(240, 720),
      selectedIds: ['node-0'],
    }))

    act(() => result.current.handlePointerDown(pointerEvent('down', 30, 12), 'node-0'))
    act(() => result.current.handlePointerMove(pointerEvent('move', 30, 238)))
    expect(requestFrame).toHaveBeenCalled()
    expect(result.current.dragPreview).not.toBeNull()
    act(() => result.current.handlePointerCancel(pointerEvent('cancel', 30, 238)))
    expect(result.current.dragPreview).toBeNull()

    unmount()
    expect(cancelFrame).toHaveBeenCalledWith(7)
  })
})
