import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { Tree, type TreeItemAdapter } from './index'

interface Item {
  id: string
  label: string
  children?: readonly Item[]
}

const nodes: readonly Item[] = [{
  id: 'root',
  label: 'Root',
  children: [{ id: 'child', label: 'Child' }],
}]

const adapter: TreeItemAdapter<Item> = {
  getChildren: (item) => item.children,
  getId: (item) => item.id,
  getLabel: (item) => item.label,
}

afterEach(cleanup)

describe('Tree', () => {
  it('OpenSpec: components / Tree 选择、键盘与过滤 / 使用键盘浏览和选择', () => {
    const onSelectionChange = vi.fn()
    const onExpandedChange = vi.fn()
    render(
      <Tree
        adapter={adapter}
        aria-label="Files"
        expandedIds={[]}
        items={nodes}
        selectedIds={[]}
        onExpandedChange={onExpandedChange}
        onSelectionChange={onSelectionChange}
      />,
    )

    const row = screen.getByRole('row', { name: /Root/ })
    expect(row).toHaveAttribute('aria-level', '1')
    expect(row).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(row)
    expect(onSelectionChange).toHaveBeenCalledWith(['root'])
    fireEvent.keyDown(row, { key: 'ArrowRight' })
    expect(onExpandedChange).toHaveBeenCalledWith(['root'])
  })

  it('OpenSpec: components / 通用受控虚拟 Tree / 组合领域行内容', () => {
    render(
      <Tree
        adapter={adapter}
        aria-label="Files"
        expandedIds={[]}
        items={nodes}
        renderActions={({ item }) => <button>{`Action ${item.label}`}</button>}
        renderIcon={({ item }) => <span>{`Icon ${item.label}`}</span>}
        renderLabel={({ item }) => <strong>{item.label}</strong>}
        selectedIds={['root']}
      />,
    )
    expect(screen.getByRole('treegrid', { name: 'Files' })).toBeInTheDocument()
    expect(screen.getByText('Icon Root')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action Root' })).toBeInTheDocument()
  })

  it('OpenSpec: components / 通用受控虚拟 Tree / 虚拟化 5000+ 个节点', () => {
    const manyItems = Array.from({ length: 5_001 }, (_, index) => ({
      id: `item-${index}`,
      label: `Item ${index}`,
    }))
    render(
      <Tree
        adapter={adapter}
        aria-label="Large files"
        expandedIds={[]}
        items={manyItems}
        selectedIds={[]}
      />,
    )
    const renderedRows = screen.getAllByRole('row')
    expect(renderedRows.length).toBeLessThan(100)
    expect(renderedRows[0]).toHaveAttribute('aria-setsize', '5001')
  })

  it('OpenSpec: components / Tree 选择、键盘与过滤 / Shift 范围选择保持受控状态', () => {
    function Harness() {
      const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
      return (
        <Tree
          adapter={adapter}
          aria-label="Selectable files"
          expandedIds={['root']}
          items={nodes}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('row', { name: /Root/ }))
    fireEvent.click(screen.getByRole('row', { name: /Child/ }), { shiftKey: true })
    expect(screen.getByRole('row', { name: /Root/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('row', { name: /Child/ })).toHaveAttribute('aria-selected', 'true')
  })
})
