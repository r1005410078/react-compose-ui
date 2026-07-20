import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SceneTree, useSceneTreeCommands } from './index'
import type { SceneTreeNode, SceneTreeOperation } from './index'

const nodes: readonly SceneTreeNode[] = [
  {
    id: 'page',
    label: 'Page 1',
    children: [
      { id: 'red', label: 'Red rectangle' },
      { id: 'blue', label: 'Blue Rectangle', locked: true },
    ],
  },
]

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  cleanup()
})

function renderTree(overrides: Partial<React.ComponentProps<typeof SceneTree>> = {}) {
  const onSelectionChange = vi.fn()
  const onExpandedChange = vi.fn()
  const onOperation = vi.fn<(operation: SceneTreeOperation) => void>()
  render(
    <SceneTree
      nodes={nodes}
      selectedIds={[]}
      expandedIds={['page']}
      onSelectionChange={onSelectionChange}
      onExpandedChange={onExpandedChange}
      onOperation={onOperation}
      {...overrides}
    />,
  )
  return { onSelectionChange, onExpandedChange, onOperation }
}

describe('SceneTree', () => {
  it('OpenSpec: scene-tree / 独立受控场景树包 / 独立渲染场景树', async () => {
    renderTree({ selectedIds: ['blue'] })

    expect(screen.getByRole('treegrid', { name: '场景树' })).toBeInTheDocument()
    expect(await screen.findByRole('row', { name: /Blue Rectangle/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('OpenSpec: scene-tree / 大规模虚拟化树 / 渲染 5000 个展开节点', async () => {
    const largeNodes = Array.from({ length: 5000 }, (_, index) => ({
      id: `node-${index}`,
      label: `Node ${index}`,
    }))
    renderTree({ nodes: largeNodes, expandedIds: [] })

    expect((await screen.findAllByRole('row')).length).toBeLessThanOrEqual(80)
    expect(screen.queryByText('Node 4999')).not.toBeInTheDocument()
  })

  it('OpenSpec: scene-tree / 树选择与导航 / 使用鼠标组合选择', async () => {
    const { onSelectionChange } = renderTree({ selectedIds: ['red'] })

    fireEvent.click(await screen.findByRole('row', { name: /Blue Rectangle/ }), {
      metaKey: true,
    })
    expect(onSelectionChange).toHaveBeenLastCalledWith(['red', 'blue'])
  })

  it('OpenSpec: scene-tree / 树选择与导航 / Ctrl 点击不打开右键菜单', async () => {
    const { onSelectionChange } = renderTree({ selectedIds: ['red'] })
    const blueRow = await screen.findByRole('row', { name: /Blue Rectangle/ })

    fireEvent.contextMenu(blueRow, { ctrlKey: true })

    expect(onSelectionChange).toHaveBeenLastCalledWith(['red', 'blue'])
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('OpenSpec: scene-tree / 树选择与导航 / 使用键盘浏览树', async () => {
    renderTree()
    fireEvent.keyDown(await screen.findByRole('row', { name: /Page 1/ }), { key: 'End' })

    await waitFor(() => {
      expect(screen.getByRole('row', { name: /Blue Rectangle/ })).toHaveFocus()
    })
  })

  it('OpenSpec: scene-tree / 新增节点入口 / 使用新增按钮', () => {
    const { onOperation } = renderTree({ selectedIds: ['page'] })

    fireEvent.click(screen.getByRole('button', { name: '新增节点' }))
    expect(onOperation).toHaveBeenCalledWith({
      type: 'create',
      parentId: 'page',
      index: 2,
    })
    expect(screen.getAllByRole('button', { name: '新增节点' })).toHaveLength(1)
  })

  it('OpenSpec: scene-tree / 新增节点入口 / 计算建议插入位置', () => {
    const { onOperation } = renderTree({ nodes: [], selectedIds: [], expandedIds: [] })
    fireEvent.click(screen.getByRole('button', { name: '新增节点' }))
    expect(onOperation).toHaveBeenCalledWith({ type: 'create', parentId: null, index: 0 })
  })

  it('OpenSpec: scene-tree / 节点检索 / 使用普通与组合检索', async () => {
    renderTree()
    const search = screen.getByRole('searchbox', { name: '搜索节点' })

    fireEvent.click(screen.getByRole('button', { name: '大小写敏感' }))
    fireEvent.click(screen.getByRole('button', { name: '全词匹配' }))
    fireEvent.change(search, { target: { value: 'Blue Rectangle' } })

    expect(await screen.findByRole('row', { name: /Blue Rectangle/ })).toBeVisible()
    expect(screen.queryByRole('row', { name: /Red rectangle/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '大小写敏感' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('OpenSpec: scene-tree / 节点检索 / 输入无效正则表达式', () => {
    renderTree()
    fireEvent.click(screen.getByRole('button', { name: '正则表达式' }))
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索节点' }), {
      target: { value: '[' },
    })

    expect(screen.getByRole('searchbox', { name: '搜索节点' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('正则表达式无效')
    expect(within(screen.getByRole('treegrid')).queryAllByRole('row')).toHaveLength(0)
  })

  it('OpenSpec: scene-tree / 节点检索 / 清空检索', async () => {
    renderTree({ selectedIds: ['blue'] })
    const search = screen.getByRole('searchbox', { name: '搜索节点' })
    fireEvent.change(search, { target: { value: 'Red' } })
    expect(screen.queryByRole('row', { name: /Blue Rectangle/ })).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: '' } })
    expect(await screen.findByRole('row', { name: /Blue Rectangle/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 编辑允许操作的节点', async () => {
    const { onOperation } = renderTree({ selectedIds: ['red'] })
    const redRow = await screen.findByRole('row', { name: /Red rectangle/ })

    fireEvent.doubleClick(redRow)
    expect(screen.queryByRole('textbox', { name: '重命名 Red rectangle' })).not.toBeInTheDocument()
    fireEvent.keyDown(redRow, { key: 'Enter' })
    const renameInput = screen.getByRole('textbox', { name: '重命名 Red rectangle' })
    fireEvent.change(renameInput, { target: { value: 'Hero rectangle' } })
    fireEvent.keyDown(renameInput, { key: 'Enter' })
    expect(onOperation).toHaveBeenCalledWith({
      type: 'rename',
      nodeId: 'red',
      label: 'Hero rectangle',
    })

    fireEvent.click(screen.getByRole('button', { name: '隐藏 Red rectangle' }))
    expect(onOperation).toHaveBeenCalledWith({
      type: 'set-visibility',
      nodeIds: ['red'],
      visible: false,
    })

    fireEvent.keyDown(redRow, { key: 'Delete' })
    expect(onOperation).toHaveBeenCalledWith({ type: 'delete', nodeIds: ['red'] })
  })

  it('deletes the focused unselected row instead of the stale selection', async () => {
    const unlockedNodes: readonly SceneTreeNode[] = [{
      ...nodes[0],
      children: nodes[0]?.children?.map((node) => ({ ...node, locked: false })),
    }]
    const { onOperation } = renderTree({ nodes: unlockedNodes, selectedIds: ['red'] })
    const redRow = await screen.findByRole('row', { name: /Red rectangle/ })
    const blueRow = screen.getByRole('row', { name: /Blue Rectangle/ })

    fireEvent.keyDown(redRow, { key: 'ArrowDown' })
    await waitFor(() => expect(blueRow).toHaveFocus())
    fireEvent.keyDown(blueRow, { key: 'Delete' })

    expect(onOperation).toHaveBeenLastCalledWith({ type: 'delete', nodeIds: ['blue'] })
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 使用平台键位开始重命名 - Windows', async () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32')
    renderTree({ selectedIds: ['red'] })
    const redRow = await screen.findByRole('row', { name: /Red rectangle/ })

    fireEvent.keyDown(redRow, { key: 'Enter' })
    expect(screen.queryByRole('textbox', { name: '重命名 Red rectangle' })).not.toBeInTheDocument()
    fireEvent.keyDown(redRow, { key: 'F2' })
    expect(screen.getByRole('textbox', { name: '重命名 Red rectangle' })).toBeVisible()
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 节点禁止某项操作', async () => {
    renderTree()
    expect(
      within(await screen.findByRole('row', { name: /Blue Rectangle/ }))
        .getByRole('button', { name: '隐藏 Blue Rectangle' }),
    ).toBeDisabled()
  })

  it('OpenSpec: scene-tree / 新增节点入口 / 使用上下文菜单新增', async () => {
    const { onOperation, onSelectionChange } = renderTree()
    fireEvent.contextMenu(await screen.findByRole('row', { name: /Blue Rectangle/ }), {
      clientX: 20,
      clientY: 30,
    })

    expect(onSelectionChange).toHaveBeenCalledWith(['blue'])
    const menuItem = screen.getByRole('menuitem', { name: '新增兄弟节点' })
    expect(menuItem).toHaveFocus()
    fireEvent.click(menuItem)
    expect(onOperation).toHaveBeenCalledWith({
      type: 'create',
      parentId: 'page',
      index: 2,
    })
  })

  it('OpenSpec: scene-tree / 新增节点入口 / 从选中节点右键新增子节点', async () => {
    const { onOperation } = renderTree({ selectedIds: ['red'] })
    fireEvent.contextMenu(await screen.findByRole('row', { name: /Red rectangle/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: '新增子节点' }))

    expect(onOperation).toHaveBeenCalledWith({
      type: 'create',
      parentId: 'red',
      index: 0,
    })
  })

  it('OpenSpec: scene-tree / 场景树命令菜单与快捷键 / 打开节点命令菜单', async () => {
    const { onSelectionChange } = renderTree({ selectedIds: ['red'] })
    fireEvent.contextMenu(await screen.findByRole('row', { name: /Red rectangle/ }))

    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      '新增子节点',
      '新增兄弟节点',
      '复制',
      '剪切',
      '粘贴为子节点',
      '粘贴为兄弟节点',
      '删除',
    ])
    expect(within(menu).getByRole('menuitem', { name: '粘贴为子节点' })).toBeDisabled()
    expect(within(menu).getByRole('menuitem', { name: '删除' })).toHaveAttribute('data-danger', 'true')
    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('OpenSpec: scene-tree / 场景树命令菜单与快捷键 / 打开空白区命令菜单', () => {
    renderTree()
    fireEvent.contextMenu(screen.getByRole('treegrid', { name: '场景树' }))

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      '新增根节点',
      '粘贴到根级',
    ])
  })

  it('OpenSpec: scene-tree / 场景树命令菜单与快捷键 / 使用场景树命令快捷键', async () => {
    const { onOperation } = renderTree({ selectedIds: ['red'] })
    const redRow = await screen.findByRole('row', { name: /Red rectangle/ })

    fireEvent.keyDown(redRow, { key: 'c', metaKey: true })
    fireEvent.keyDown(redRow, { key: 'v', metaKey: true })
    expect(onOperation).toHaveBeenCalledWith({
      type: 'duplicate',
      sourceNodeIds: ['red'],
      parentId: 'red',
      index: 0,
    })
  })

  it('OpenSpec: scene-tree / 场景树命令菜单与快捷键 / 使用命令菜单键盘导航', async () => {
    renderTree({ selectedIds: ['red'] })
    fireEvent.contextMenu(await screen.findByRole('row', { name: /Red rectangle/ }))
    const first = screen.getByRole('menuitem', { name: '新增子节点' })
    const second = screen.getByRole('menuitem', { name: '新增兄弟节点' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(second).toHaveFocus()
    fireEvent.keyDown(second, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('OpenSpec: scene-tree / 场景树命令菜单与快捷键 / 外部与菜单共享命令状态', async () => {
    function Harness() {
      const [selectedIds, setSelectedIds] = useState<readonly string[]>(['red'])
      const controller = useSceneTreeCommands({ nodes, selectedIds })
      return (
        <>
          <button type="button" onClick={() => controller.execute('copy')}>外部复制</button>
          <SceneTree
            commands={controller}
            expandedIds={['page']}
            nodes={nodes}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </>
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: '外部复制' }))
    fireEvent.contextMenu(await screen.findByRole('row', { name: /Red rectangle/ }))
    expect(screen.getByRole('menuitem', { name: '粘贴为子节点' })).toBeEnabled()
  })

  it('OpenSpec: scene-tree / 场景树命令菜单与快捷键 / 输入框快捷键隔离', () => {
    const { onOperation } = renderTree({ selectedIds: ['red'] })
    const search = screen.getByRole('searchbox', { name: '搜索节点' })
    fireEvent.keyDown(search, { key: 'x', metaKey: true })
    fireEvent.keyDown(search, { key: 'v', metaKey: true })
    expect(onOperation).not.toHaveBeenCalled()
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 使用静态节点和落点横线拖拽', async () => {
    const { onOperation } = renderTree()
    const tree = screen.getByRole('treegrid', { name: '场景树' })
    const redRow = await screen.findByRole('row', { name: /Red rectangle/ })
    const before = screen.getAllByRole('row').map((row) => row.textContent)

    fireEvent.pointerDown(redRow, { button: 0, pointerId: 1, clientX: 30, clientY: 36 })
    fireEvent.pointerMove(tree, { pointerId: 1, clientX: 30, clientY: 23 })

    expect(screen.getByTestId('scene-tree-drop-indicator')).toBeVisible()
    expect(screen.getAllByRole('row').map((row) => row.textContent)).toEqual(before)
    expect(onOperation).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'move' }))

    fireEvent.pointerUp(tree, { pointerId: 1, clientX: 30, clientY: 23 })
    expect(onOperation).toHaveBeenCalledTimes(1)
    expect(onOperation).toHaveBeenCalledWith({
      type: 'move',
      nodeIds: ['red'],
      parentId: 'page',
      index: 2,
    })
    expect(screen.queryByTestId('scene-tree-drop-indicator')).not.toBeInTheDocument()
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 通过横向位置改变层级 - 从文字区域保持层级', async () => {
    const { onOperation } = renderTree({ selectedIds: ['red'] })
    const tree = screen.getByRole('treegrid', { name: '场景树' })
    const redLabel = await screen.findByRole('gridcell', { name: 'Red rectangle' })

    fireEvent.pointerDown(redLabel, {
      button: 0,
      pointerId: 7,
      clientX: 180,
      clientY: 36,
    })
    fireEvent.pointerMove(tree, { pointerId: 7, clientX: 180, clientY: 23 })

    expect(screen.getByTestId('scene-tree-drop-indicator')).toBeVisible()
    fireEvent.pointerUp(tree, { pointerId: 7, clientX: 180, clientY: 23 })
    expect(onOperation).toHaveBeenCalledWith({
      type: 'move',
      nodeIds: ['red'],
      parentId: 'page',
      index: 2,
    })
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 拖动多个选中节点 - 未选节点先单选', async () => {
    const unlockedNodes: readonly SceneTreeNode[] = [{
      ...nodes[0],
      children: nodes[0]?.children?.map((node) => ({ ...node, locked: false })),
    }]
    const { onSelectionChange } = renderTree({ nodes: unlockedNodes, selectedIds: ['red'] })
    const tree = screen.getByRole('treegrid', { name: '场景树' })
    const blueRow = await screen.findByRole('row', { name: /Blue Rectangle/ })

    fireEvent.pointerDown(blueRow, { button: 0, pointerId: 2, clientX: 30, clientY: 60 })
    fireEvent.pointerMove(tree, { pointerId: 2, clientX: 8, clientY: 12 })

    expect(onSelectionChange).toHaveBeenCalledWith(['blue'])
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 使用静态节点和落点横线拖拽 - 取消', async () => {
    const { onOperation } = renderTree()
    const tree = screen.getByRole('treegrid', { name: '场景树' })
    const redRow = await screen.findByRole('row', { name: /Red rectangle/ })

    fireEvent.pointerDown(redRow, { button: 0, pointerId: 3, clientX: 30, clientY: 36 })
    fireEvent.pointerMove(tree, { pointerId: 3, clientX: 30, clientY: 23 })
    expect(screen.getByTestId('scene-tree-drop-indicator')).toBeVisible()
    expect(screen.getByTestId('scene-tree-drag-preview')).toHaveTextContent('Red rectangle')

    fireEvent.pointerCancel(tree, { pointerId: 3 })
    expect(screen.queryByTestId('scene-tree-drop-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('scene-tree-drag-preview')).not.toBeInTheDocument()
    expect(onOperation).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'move' }))
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 显示单节点和多节点拖拽预览', async () => {
    const unlockedNodes: readonly SceneTreeNode[] = [{
      ...nodes[0],
      children: nodes[0]?.children?.map((node) => ({ ...node, locked: false })),
    }]
    renderTree({ nodes: unlockedNodes, selectedIds: ['red', 'blue'] })
    const tree = screen.getByRole('treegrid', { name: '场景树' })
    const redRow = await screen.findByRole('row', { name: /Red rectangle/ })

    fireEvent.pointerDown(redRow, { button: 0, pointerId: 8, clientX: 120, clientY: 36 })
    fireEvent.pointerMove(tree, { pointerId: 8, clientX: 130, clientY: 60 })

    expect(screen.getByTestId('scene-tree-drag-preview')).toHaveTextContent('2')
    expect(screen.getByTestId('scene-tree-drag-preview')).toHaveAttribute('aria-hidden', 'true')
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 显示单节点和多节点拖拽预览 - 使用实际移动数量', async () => {
    renderTree({ selectedIds: ['red', 'blue'] })
    const tree = screen.getByRole('treegrid', { name: '场景树' })
    const redRow = await screen.findByRole('row', { name: /Red rectangle/ })

    fireEvent.pointerDown(redRow, { button: 0, pointerId: 10, clientX: 120, clientY: 36 })
    fireEvent.pointerMove(tree, { pointerId: 10, clientX: 130, clientY: 60 })

    expect(screen.getByTestId('scene-tree-drag-preview')).toHaveTextContent('Red rectangle')
    expect(screen.getByTestId('scene-tree-drag-preview')).not.toHaveTextContent('2')
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 将拖动节点放入目标节点', async () => {
    const { onOperation } = renderTree({ selectedIds: ['red'] })
    const tree = screen.getByRole('treegrid', { name: '场景树' })
    const redRow = await screen.findByRole('row', { name: /Red rectangle/ })
    const pageRow = screen.getByRole('row', { name: /Page 1/ })

    fireEvent.pointerDown(redRow, { button: 0, pointerId: 9, clientX: 120, clientY: 36 })
    fireEvent.pointerMove(tree, { pointerId: 9, clientX: 120, clientY: 12 })

    expect(pageRow).toHaveAttribute('data-scene-drop-target', 'inside')
    expect(screen.queryByTestId('scene-tree-drop-indicator')).not.toBeInTheDocument()
    fireEvent.pointerUp(tree, { pointerId: 9, clientX: 120, clientY: 12 })
    expect(onOperation).toHaveBeenCalledWith({
      type: 'move',
      nodeIds: ['red'],
      parentId: 'page',
      index: 2,
    })
    expect(screen.queryByTestId('scene-tree-drag-preview')).not.toBeInTheDocument()
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 使用静态节点和落点横线拖拽 - Escape', async () => {
    const { onOperation } = renderTree()
    const tree = screen.getByRole('treegrid', { name: '场景树' })
    const redRow = await screen.findByRole('row', { name: /Red rectangle/ })

    fireEvent.pointerDown(redRow, { button: 0, pointerId: 5, clientX: 30, clientY: 36 })
    fireEvent.pointerMove(tree, { pointerId: 5, clientX: 30, clientY: 71 })
    fireEvent.keyDown(redRow, { key: 'Escape' })

    expect(screen.queryByTestId('scene-tree-drop-indicator')).not.toBeInTheDocument()
    expect(onOperation).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'move' }))
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 通过横向位置改变层级 - 搜索时禁用', async () => {
    const { onOperation } = renderTree()
    const search = screen.getByRole('searchbox', { name: '搜索节点' })
    fireEvent.change(search, { target: { value: 'Red' } })
    const tree = screen.getByRole('treegrid', { name: '场景树' })
    const redRow = await screen.findByRole('row', { name: /Red rectangle/ })

    fireEvent.pointerDown(redRow, { button: 0, pointerId: 6, clientX: 30, clientY: 36 })
    fireEvent.pointerMove(tree, { pointerId: 6, clientX: 30, clientY: 60 })
    fireEvent.pointerUp(tree, { pointerId: 6, clientX: 30, clientY: 60 })

    expect(screen.queryByTestId('scene-tree-drop-indicator')).not.toBeInTheDocument()
    expect(onOperation).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'move' }))
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 拖拽期间展开和滚动', async () => {
    const hoverNodes: readonly SceneTreeNode[] = [
      { id: 'folder', label: 'Folder', children: [{ id: 'child', label: 'Child' }] },
      { id: 'loose', label: 'Loose', canHaveChildren: false },
    ]
    const { onExpandedChange } = renderTree({
      nodes: hoverNodes,
      expandedIds: [],
      selectedIds: ['loose'],
    })
    const tree = screen.getByRole('treegrid', { name: '场景树' })
    const looseRow = await screen.findByRole('row', { name: /Loose/ })
    vi.useFakeTimers()

    fireEvent.pointerDown(looseRow, { button: 0, pointerId: 4, clientX: 14, clientY: 36 })
    fireEvent.pointerMove(tree, { pointerId: 4, clientX: 30, clientY: 12 })
    await act(() => vi.advanceTimersByTimeAsync(600))

    expect(onExpandedChange).toHaveBeenCalledWith(['folder'])
  })
})
