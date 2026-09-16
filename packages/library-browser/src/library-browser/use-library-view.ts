import { normalizeComposeAssetError } from '@compose-ui/assets'
import type { ComposeLibraryQuery, ComposeLibraryRecord } from '@compose-ui/library'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ComposeLibraryLocation,
  ComposeLibraryViewState,
  LibraryLoadState,
  LibraryPortRef,
} from './library-browser-types'

const EMPTY: LibraryLoadState = {
  status: 'idle',
  items: [],
  categories: [],
  categoryCounts: new Map(),
  locationCounts: { project: 0, template: 0, trash: 0 },
  nextCursor: null,
  error: null,
}

/** 把左栏那四个去处翻译成端口的查询条件。 @internal */
export function queryOfLocation(location: ComposeLibraryLocation): Pick<
  ComposeLibraryQuery,
  'kind' | 'deleted'
> {
  // 回收站跨 kind（它是正交的 deletedAt），因此这一档不带 kind——带上会让「回收站里的模板」
  // 看不见，而用户按的是「回收站」不是「项目的回收站」。
  if (location === 'trash') return { deleted: true }
  if (location === 'template') return { kind: 'template' }
  return { kind: 'project' }
}

/**
 * 页面库那一屏的查询状态机。
 *
 * @remarks
 * 视图状态（在哪儿找、找哪一类、怎么排、搜什么）是**会话级的**，不写进任何文档也不持久化
 * ——它回答「我这会儿想怎么看」。
 *
 * 一次 `query()` 同时喂左栏的计数与主区的图：分两次取会让用户改一次筛选就看到计数是旧的、
 * 图是新的，而那个不一致屏幕上没有任何东西解释。
 * @internal
 */
export function useLibraryView(port: LibraryPortRef, pageSize: number) {
  const [state, setState] = useState<ComposeLibraryViewState>({
    location: 'project',
    category: undefined,
    search: '',
    sort: 'modified-desc',
    view: 'grid',
  })
  const [load, setLoad] = useState<LibraryLoadState>(EMPTY)
  const [recents, setRecents] = useState<readonly ComposeLibraryRecord[]>([])
  // 每次查询自带一个令牌：迟到的结果不得覆盖新的一次，否则快速切筛选会看到上一次的图。
  const tokenRef = useRef(0)
  const [reloadKey, setReloadKey] = useState(0)

  const { location, category, search, sort } = state

  const runQuery = useCallback(async (cursor: string | undefined) => {
    const token = tokenRef.current + 1
    tokenRef.current = token
    setLoad((current) => ({ ...current, status: 'loading', error: null }))
    try {
      const page = await port.query({
        ...queryOfLocation(location),
        ...(category === undefined ? {} : { categories: [category] }),
        ...(search.trim() === '' ? {} : { search: search.trim() }),
        sort,
        limit: pageSize,
        ...(cursor === undefined ? {} : { cursor }),
      })
      const categories = await port.listCategories()
      if (tokenRef.current !== token) return
      setLoad((current) => ({
        status: 'ready',
        // 续页时接在后面；换条件时（没有 cursor）整段替换。
        items: cursor === undefined ? page.items : [...current.items, ...page.items],
        categories,
        categoryCounts: new Map(page.facets.byCategory.map((facet) => [facet.category, facet.count])),
        locationCounts: page.facets.byLocation,
        nextCursor: page.nextCursor,
        error: null,
      }))
    }
    catch (error) {
      if (tokenRef.current !== token) return
      setLoad((current) => ({ ...current, status: 'failed', error: normalizeComposeAssetError(error) }))
    }
  }, [category, location, pageSize, port, search, sort])

  useEffect(() => {
    void runQuery(undefined)
  }, [runQuery, reloadKey])

  // 「最近打开」是另一条：它不受筛选影响，回答的是「回到刚才那张」。
  useEffect(() => {
    if (location !== 'recent' || !port.listRecents) {
      setRecents([])
      return
    }
    let cancelled = false
    void port.listRecents({ limit: pageSize }).then((result) => {
      if (!cancelled) setRecents(result)
    }).catch(() => {
      if (!cancelled) setRecents([])
    })
    return () => { cancelled = true }
  }, [location, pageSize, port, reloadKey])

  // 端口自己报失效时重来一遍：别处（编辑器保存、另一个标签页）改了东西，这一屏要跟上。
  useEffect(() => port.subscribe?.(() => {
    setReloadKey((current) => current + 1)
  }), [port])

  const patch = useCallback((next: Partial<ComposeLibraryViewState>) => {
    setState((current) => ({ ...current, ...next }))
  }, [])

  const loadMore = useCallback(() => {
    if (load.nextCursor === null || load.status === 'loading') return
    void runQuery(load.nextCursor)
  }, [load.nextCursor, load.status, runQuery])

  const retry = useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  const items = location === 'recent' ? recents : load.items

  return useMemo(() => ({
    state,
    patch,
    load,
    items,
    loadMore,
    retry,
  }), [items, load, loadMore, patch, retry, state])
}
