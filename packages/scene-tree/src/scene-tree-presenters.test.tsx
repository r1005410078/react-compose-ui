import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SceneTreeContextMenu } from './scene-tree-context-menu'
import { SceneTreeRow } from './scene-tree-row'
import { SceneTreeToolbar } from './scene-tree-toolbar'
import type { ComposeSceneTreeCommandController } from './index'
import type { IndexedSceneTreeNode } from './tree-model'

describe('scene tree presenters', () => {
  it('renders toolbar state and forwards search actions', () => {
    const onAdd = vi.fn()
    const onQueryChange = vi.fn()
    render(
      <SceneTreeToolbar
        caseSensitive
        error="正则表达式无效"
        query="["
        regex
        wholeWord={false}
        onAdd={onAdd}
        onCaseSensitiveChange={vi.fn()}
        onQueryChange={onQueryChange}
        onRegexChange={vi.fn()}
        onWholeWordChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '新增节点' }))
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索节点' }), {
      target: { value: 'Page' },
    })
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onQueryChange).toHaveBeenCalledWith('Page')
    expect(screen.getByRole('button', { name: '大小写敏感' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('正则表达式无效')
  })

  it('renders row ARIA state and forwards node actions', () => {
    const row: IndexedSceneTreeNode = {
      node: { id: 'node', label: 'Node' },
      parentId: 'page',
      depth: 2,
      index: 0,
      setSize: 1,
      ancestorIds: ['page'],
    }
    const onToggleVisibility = vi.fn()
    render(
      <SceneTreeRow
        editing={false}
        expanded={false}
        focused
        insideDropTarget={false}
        isDragging={false}
        queryActive={false}
        row={row}
        selected
        virtualStart={24}
        onClick={vi.fn()}
        onContextMenu={vi.fn()}
        onFocus={vi.fn()}
        onKeyDown={vi.fn()}
        onPointerDown={vi.fn()}
        onRenameCancel={vi.fn()}
        onRenameCommit={vi.fn()}
        onToggleExpanded={vi.fn()}
        onToggleLocked={vi.fn()}
        onToggleVisibility={onToggleVisibility}
      />,
    )
    const renderedRow = screen.getByRole('row', { name: /Node/ })
    expect(renderedRow).toHaveAttribute('aria-level', '2')
    expect(renderedRow).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('button', { name: '隐藏 Node' }))
    expect(onToggleVisibility).toHaveBeenCalledWith(false)
  })

  it('renders menu ordering and forwards the selected command', () => {
    const execute = vi.fn()
    const controller: ComposeSceneTreeCommandController = {
      clipboard: null,
      clearClipboard: vi.fn(),
      execute,
      isEnabled: vi.fn(() => true),
    }
    render(
      <SceneTreeContextMenu
        commands={controller}
        nodeId="node"
        rootProps={{
          anchorPoint: { x: 20, y: 30 },
          onOpenChange: vi.fn(),
          open: true,
        }}
      />,
    )
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      '新增子节点',
      '新增兄弟节点',
      '复制',
      '剪切',
      '粘贴为子节点',
      '粘贴为兄弟节点',
      '删除',
    ])
    fireEvent.click(screen.getByRole('menuitem', { name: '新增子节点' }))
    expect(execute).toHaveBeenCalledWith('create-child', 'node')
  })
})
