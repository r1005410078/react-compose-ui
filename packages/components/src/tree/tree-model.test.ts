import { describe, expect, it } from 'vitest'
import {
  createTreeIndex,
  createTreeMove,
  flattenTree,
} from './tree-model'
import type { TreeItemAdapter } from './tree-types'

interface Item {
  id: string
  label: string
  children?: readonly Item[]
  container?: boolean
  movable?: boolean
}

const adapter: TreeItemAdapter<Item> = {
  getChildren: (item) => item.children,
  getId: (item) => item.id,
  getLabel: (item) => item.label,
  canHaveChildren: (item) => item.container !== false,
  canMove: (item) => item.movable !== false,
}

const items: readonly Item[] = [{
  id: 'root',
  label: 'Root',
  children: [{
    id: 'folder',
    label: 'Folder',
    children: [{ id: 'needle', label: 'Needle', container: false }],
  }],
}, {
  id: 'other',
  label: 'Other',
  children: [],
}]

describe('Tree model', () => {
  it('OpenSpec: components / 通用受控虚拟 Tree / 渲染大型受控树 - builds an iterative stable index', () => {
    const index = createTreeIndex(items, adapter)
    expect(index.get('needle')).toMatchObject({
      parentId: 'folder',
      depth: 3,
      ancestorIds: ['root', 'folder'],
    })
  })

  it('OpenSpec: components / Tree 选择、键盘与过滤 / 过滤树并保留路径', () => {
    const rows = flattenTree(items, adapter, {
      expandedIds: new Set(),
      filter: (item) => item.id === 'needle',
    })
    expect(rows.map((row) => row.id)).toEqual(['root', 'folder', 'needle'])
  })

  it('OpenSpec: components / Tree 拖排与可访问性 / 拖动多选项 - removes selected descendants', () => {
    const index = createTreeIndex(items, adapter)
    expect(createTreeMove({
      activeId: 'root',
      adapter,
      treeIndex: index,
      itemIds: ['root', 'needle'],
      parentId: null,
      index: 2,
    })).toEqual({ itemIds: ['root'], parentId: null, index: 1 })
  })

  it('OpenSpec: components / Tree 拖排与可访问性 / 取消或拒绝拖排 - rejects cycles', () => {
    const index = createTreeIndex(items, adapter)
    expect(createTreeMove({
      activeId: 'root',
      adapter,
      treeIndex: index,
      itemIds: ['root'],
      parentId: 'needle',
      index: 0,
    })).toBeNull()
  })
})
