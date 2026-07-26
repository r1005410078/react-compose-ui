import { describe, expect, it } from 'vitest'
import type { ComposeSceneTreeNode } from './index'
import {
  buildTreeIndex,
  createMoveTarget,
  flattenVisibleTree,
  getMovingNodeIds,
  searchTree,
} from './tree-model'

const nodes: readonly ComposeSceneTreeNode[] = [
  {
    id: 'page',
    label: 'Page 1',
    children: [
      { id: 'red', label: 'Red rectangle' },
      { id: 'blue', label: 'Blue Rectangle' },
    ],
  },
]

const dragNodes: readonly ComposeSceneTreeNode[] = [{
  id: 'page',
  label: 'Page',
  children: [
    {
      id: 'group',
      label: 'Group',
      children: [
        { id: 'a', label: 'A', canHaveChildren: false },
        { id: 'b', label: 'B', canHaveChildren: false },
      ],
    },
    { id: 'c', label: 'C', canHaveChildren: false },
    { id: 'locked-group', label: 'Locked group', locked: true },
  ],
}]

describe('scene tree model', () => {
  it('OpenSpec: scene-tree / 大规模虚拟化树 / 渲染 5000 个展开节点', () => {
    const largeNodes = Array.from({ length: 5000 }, (_, index) => ({
      id: `node-${index}`,
      label: `Node ${index}`,
    }))

    const index = buildTreeIndex(largeNodes)
    const rows = flattenVisibleTree(largeNodes, new Set())

    expect(index).toHaveLength(5000)
    expect(rows).toHaveLength(5000)
    expect(rows[rows.length - 1]?.node.id).toBe('node-4999')
  })

  it('OpenSpec: scene-tree / 大规模虚拟化树 / 虚拟行保留树语义', () => {
    const index = buildTreeIndex(nodes)
    const blue = index.get('blue')

    expect(blue).toMatchObject({
      parentId: 'page',
      depth: 2,
      index: 1,
      setSize: 2,
      ancestorIds: ['page'],
    })
  })

  it('OpenSpec: scene-tree / 节点检索 / 使用普通与组合检索', () => {
    expect(
      searchTree(nodes, 'rectangle', {
        caseSensitive: false,
        wholeWord: true,
        regex: false,
      }).rows.map((row) => row.node.id),
    ).toEqual(['page', 'red', 'blue'])

    expect(
      searchTree(nodes, '^Blue\\sRectangle$', {
        caseSensitive: true,
        wholeWord: false,
        regex: true,
      }).rows.map((row) => row.node.id),
    ).toEqual(['page', 'blue'])
  })

  it('OpenSpec: scene-tree / 节点检索 / 输入无效正则表达式', () => {
    const result = searchTree(nodes, '[', {
      caseSensitive: false,
      wholeWord: false,
      regex: true,
    })

    expect(result.rows).toEqual([])
    expect(result.error).toBe('正则表达式无效')

    const combinedResult = searchTree(nodes, '[', {
      caseSensitive: true,
      wholeWord: true,
      regex: true,
    })
    expect(combinedResult.rows).toEqual([])
    expect(combinedResult.error).toBe('正则表达式无效')
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 拖动多个选中节点 - 归一化选择', () => {
    const index = buildTreeIndex(dragNodes)
    const rows = flattenVisibleTree(dragNodes, new Set(['page', 'group']))

    expect(getMovingNodeIds(index, rows, ['a', 'b'], 'a')).toEqual(['a', 'b'])
    expect(getMovingNodeIds(index, rows, ['group', 'a', 'b'], 'group')).toEqual(['group'])
    expect(getMovingNodeIds(index, rows, ['a', 'b'], 'c')).toEqual(['c'])
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 通过横向位置改变层级', () => {
    const index = buildTreeIndex(dragNodes)
    const rows = flattenVisibleTree(dragNodes, new Set(['page', 'group']))

    expect(createMoveTarget(index, rows, ['c'], 'c', 2, 3)).toEqual({
      operation: { type: 'move', nodeIds: ['c'], parentId: 'group', index: 2 },
      depth: 3,
      lineIndex: 4,
    })
    expect(createMoveTarget(index, rows, ['a'], 'a', 5, 2)).toEqual({
      operation: { type: 'move', nodeIds: ['a'], parentId: 'page', index: 2 },
      depth: 2,
      lineIndex: 5,
    })
    expect(createMoveTarget(index, rows, ['b'], 'b', 3, 3)).toBeNull()
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 使用静态节点和落点横线拖拽 - 插入嵌套首项之前', () => {
    const index = buildTreeIndex(dragNodes)
    const rows = flattenVisibleTree(dragNodes, new Set(['page', 'group']))

    expect(createMoveTarget(index, rows, ['c'], 'c', 2, 3, 'before')).toEqual({
      operation: { type: 'move', nodeIds: ['c'], parentId: 'group', index: 0 },
      depth: 3,
      lineIndex: 2,
    })
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 展开节点底部落点紧邻节点行', () => {
    const index = buildTreeIndex(dragNodes)
    const rows = flattenVisibleTree(dragNodes, new Set(['page', 'group']))

    expect(createMoveTarget(index, rows, ['c'], 'c', 2, 1, 'after')).toEqual({
      operation: { type: 'move', nodeIds: ['c'], parentId: 'group', index: 0 },
      depth: 3,
      lineIndex: 2,
    })
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 将拖动节点放入目标节点', () => {
    const index = buildTreeIndex(dragNodes)
    const rows = flattenVisibleTree(dragNodes, new Set(['page', 'group']))
    const target = Reflect.apply(createMoveTarget, undefined, [
      index,
      rows,
      ['c'],
      'c',
      1,
      2,
      'inside',
    ])

    expect(target).toEqual({
      kind: 'inside',
      operation: { type: 'move', nodeIds: ['c'], parentId: 'group', index: 2 },
      targetNodeId: 'group',
    })
    expect(Reflect.apply(createMoveTarget, undefined, [
      index, rows, ['b'], 'b', 1, 2, 'inside',
    ])).toBeNull()
    expect(Reflect.apply(createMoveTarget, undefined, [
      index, rows, ['c'], 'c', 5, 2, 'inside',
    ])).toBeNull()
    expect(Reflect.apply(createMoveTarget, undefined, [
      index, rows, ['group'], 'group', 1, 2, 'inside',
    ])).toBeNull()
  })

  it('OpenSpec: scene-tree / 场景节点操作意图 / 通过横向位置改变层级 - 拒绝非法位置', () => {
    const index = buildTreeIndex(dragNodes)
    const rows = flattenVisibleTree(dragNodes, new Set(['page', 'group']))

    expect(createMoveTarget(index, rows, ['page'], 'page', 2, 3)).toBeNull()
    expect(createMoveTarget(index, rows, ['a'], 'a', 6, 3)).toBeNull()
  })
})
