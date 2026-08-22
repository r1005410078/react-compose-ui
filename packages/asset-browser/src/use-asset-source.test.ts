import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import { createAssetTreeMaterializer, useAssetSource } from './use-asset-source'
import type { AssetTreeEntry } from './use-asset-source'

function entry(id: string, kind: 'folder' | 'file', parentId: string | null): ComposeAssetEntry {
  return { id, name: id, kind, parentId, mediaType: 'text/plain' } as ComposeAssetEntry
}

const ROOT = entry('root', 'folder', null)

/**
 * 每个目录固定两个子项：一个子目录、一个文件。
 * `list` 每次都返回**新数组**，模拟真实 Provider——复用必须靠 folders Map 的 key 粒度，
 * 而不是靠 Provider 恰好返回同一个数组引用。
 */
function testProvider(): ComposeAssetProvider {
  return {
    id: 'test',
    label: 'test',
    root: ROOT,
    capabilities: {} as ComposeAssetProvider['capabilities'],
    list: async ({ folderId }) => [
      entry(`${folderId}/dir`, 'folder', folderId),
      entry(`${folderId}/file`, 'file', folderId),
    ],
    read: async () => ({ blob: new Blob(), revision: '1' }),
  }
}

/** 从物化树里按 id 找节点。 */
function findNode(node: AssetTreeEntry | null | undefined, id: string): AssetTreeEntry | undefined {
  if (!node) return undefined
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const hit = findNode(child, id)
    if (hit) return hit
  }
  return undefined
}

describe('useAssetSource 增量物化', () => {
  it('载入一个目录时，未受影响的子树保持引用不变', async () => {
    const provider = testProvider()
    const { result } = renderHook(() => useAssetSource(provider, 'zh-CN'))
    await waitFor(() => expect(result.current.root?.children).toBeDefined())

    // 先展开一层，得到一棵有兄弟分支的树。
    await act(async () => { await result.current.loadFolder('root/dir') })
    await waitFor(() => expect(findNode(result.current.root, 'root/dir')?.children).toBeDefined())
    const untouched = findNode(result.current.root, 'root/dir')
    const untouchedFile = findNode(result.current.root, 'root/file')

    // 再载入更深的一层：只有那一个目录的来源数组换了引用。
    await act(async () => { await result.current.loadFolder('root/dir/dir') })
    await waitFor(() => {
      expect(findNode(result.current.root, 'root/dir/dir')?.children).toBeDefined()
    })

    // 兄弟文件节点没被碰过，必须是同一个对象——否则下游 memo 全部失效。
    expect(findNode(result.current.root, 'root/file')).toBe(untouchedFile)
    // 被载入目录的祖先链会重建（children 变了），但它确实换了内容。
    expect(findNode(result.current.root, 'root/dir')).not.toBe(untouched)
  })

  it('状态没有变化时重渲染返回同一棵树', async () => {
    const provider = testProvider()
    const { result, rerender } = renderHook(() => useAssetSource(provider, 'zh-CN'))
    await waitFor(() => expect(result.current.root?.children).toBeDefined())
    const before = result.current.root
    rerender()
    expect(result.current.root).toBe(before)
  })

  it('物化结果不再携带每目录的加载标志', async () => {
    const provider = testProvider()
    const { result } = renderHook(() => useAssetSource(provider, 'zh-CN'))
    await waitFor(() => expect(result.current.root?.children).toBeDefined())
    // loading 只作为 Set 暴露给 UI 查询，不写进每个节点——否则展开一个目录会因为
    // setLoading 的增删各触发一次整树重建。
    expect(result.current.root).not.toHaveProperty('loading')
    expect(result.current.loading).toBeInstanceOf(Set)
  })

  it('目录优先并按 collator 排序', async () => {
    const provider = testProvider()
    const { result } = renderHook(() => useAssetSource(provider, 'zh-CN'))
    await waitFor(() => expect(result.current.root?.children).toBeDefined())
    expect(result.current.root?.children?.map((child) => child.kind)).toEqual(['folder', 'file'])
  })
})

describe('createAssetTreeMaterializer', () => {
  const root = entry('root', 'folder', null)

  /** a/ 与 b/ 两个兄弟目录，各带一个文件。 */
  function folders() {
    return new Map<string, readonly ComposeAssetEntry[]>([
      ['root', [entry('a', 'folder', 'root'), entry('b', 'folder', 'root')]],
      ['a', [entry('a1', 'file', 'a')]],
      ['b', [entry('b1', 'file', 'b')]],
    ])
  }

  it('只有来源换了引用的那条路径重建，兄弟子树按引用复用', () => {
    const materializer = createAssetTreeMaterializer()
    const source = folders()
    const first = materializer.materialize(root, source, 'zh-CN')

    // 只替换 b 的来源数组；root 与 a 的来源引用原样保留。
    const changed = new Map(source)
    changed.set('b', [entry('b2', 'file', 'b')])
    const second = materializer.materialize(root, changed, 'zh-CN')

    // 根的 children 变了，根本身必须重建。
    expect(second).not.toBe(first)
    // a 分支完全没被碰过：整棵子树是同一个对象，下游 memo 因此还能命中。
    expect(second.children?.[0]).toBe(first.children?.[0])
    // b 分支内容变了，重建并反映新内容。
    expect(second.children?.[1]).not.toBe(first.children?.[1])
    expect(second.children?.[1]?.children?.[0]?.id).toBe('b2')
  })

  it('输入完全没变时整棵树按引用返回', () => {
    const materializer = createAssetTreeMaterializer()
    const source = folders()
    const first = materializer.materialize(root, source, 'zh-CN')
    expect(materializer.materialize(root, source, 'zh-CN')).toBe(first)
  })

  it('环形数据不会无限递归', () => {
    const materializer = createAssetTreeMaterializer()
    const cyclic = new Map<string, readonly ComposeAssetEntry[]>([
      ['root', [entry('a', 'folder', 'root')]],
      ['a', [entry('root', 'folder', 'a')]],
    ])
    expect(() => materializer.materialize(root, cyclic, 'zh-CN')).not.toThrow()
  })
})
