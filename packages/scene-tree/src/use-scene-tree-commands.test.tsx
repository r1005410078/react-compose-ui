import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useComposeSceneTreeCommands } from './index'
import type { ComposeSceneTreeNode, ComposeSceneTreeOperation } from './index'

const nodes: readonly ComposeSceneTreeNode[] = [{
  id: 'page',
  label: 'Page',
  canMove: false,
  children: [
    { id: 'a', label: 'A', children: [{ id: 'a-child', label: 'A child' }] },
    { id: 'locked', label: 'Locked', locked: true },
    { id: 'leaf', label: 'Leaf', canHaveChildren: false },
  ],
}]

function setup(selectedIds: readonly string[]) {
  const onOperation = vi.fn<(operation: ComposeSceneTreeOperation) => void>()
  const hook = renderHook(() => useComposeSceneTreeCommands({ nodes, selectedIds, onOperation }))
  return { ...hook, onOperation }
}

describe('useComposeSceneTreeCommands', () => {
  it('OpenSpec: scene-tree / 受控场景树命令 / 计算新增命令位置', () => {
    const { result, onOperation } = setup(['a'])
    act(() => result.current.execute('create-child', 'a'))
    act(() => result.current.execute('create-sibling', 'a'))
    act(() => result.current.execute('create-root', null))
    expect(onOperation.mock.calls.map(([operation]) => operation)).toEqual([
      { type: 'create', parentId: 'a', index: 1 },
      { type: 'create', parentId: 'page', index: 1 },
      { type: 'create', parentId: null, index: 1 },
    ])
    expect(result.current.isEnabled('create-child', 'leaf')).toBe(false)
  })

  it('OpenSpec: scene-tree / 受控场景树命令 / 规范化批量命令来源', () => {
    const { result, onOperation } = setup(['locked', 'a-child', 'a'])
    act(() => result.current.execute('copy'))
    expect(result.current.clipboard).toEqual({ kind: 'copy', nodeIds: ['a', 'locked'] })
    act(() => result.current.execute('delete'))
    expect(onOperation).toHaveBeenCalledWith({ type: 'delete', nodeIds: ['a'] })
  })

  it('OpenSpec: scene-tree / 受控场景树命令 / 复制并重复粘贴节点', () => {
    const { result, onOperation } = setup(['a'])
    act(() => result.current.execute('copy'))
    act(() => result.current.execute('paste-child', 'a-child'))
    act(() => result.current.execute('paste-root', null))
    expect(onOperation).toHaveBeenNthCalledWith(1, {
      type: 'duplicate', sourceNodeIds: ['a'], parentId: 'a-child', index: 0,
    })
    expect(onOperation).toHaveBeenNthCalledWith(2, {
      type: 'duplicate', sourceNodeIds: ['a'], parentId: null, index: 1,
    })
    expect(result.current.clipboard?.kind).toBe('copy')
  })

  it('OpenSpec: scene-tree / 受控场景树命令 / 剪切并移动节点', () => {
    const { result, onOperation } = setup(['leaf'])
    act(() => result.current.execute('cut'))
    act(() => result.current.execute('paste-sibling', 'a'))
    act(() => result.current.execute('paste-root', null))
    expect(onOperation).toHaveBeenCalledTimes(1)
    expect(onOperation).toHaveBeenCalledWith({
      type: 'move', nodeIds: ['leaf'], parentId: 'page', index: 1,
    })
    expect(result.current.clipboard).toBeNull()
  })

  it('OpenSpec: scene-tree / 受控场景树命令 / 删除和清空剪贴板', () => {
    const { result } = setup(['a'])
    act(() => result.current.execute('copy'))
    expect(result.current.isEnabled('paste-root', null)).toBe(true)
    act(() => result.current.clearClipboard())
    expect(result.current.isEnabled('paste-root', null)).toBe(false)
  })

  it('uses an explicit unselected target for source commands', () => {
    const { result, onOperation } = setup(['a'])

    act(() => result.current.execute('copy', 'leaf'))
    expect(result.current.clipboard).toEqual({ kind: 'copy', nodeIds: ['leaf'] })
    act(() => result.current.execute('delete', 'leaf'))
    expect(onOperation).toHaveBeenCalledWith({ type: 'delete', nodeIds: ['leaf'] })
  })
})
