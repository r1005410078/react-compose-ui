import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import { normalizeComposeAssetError } from '@compose-ui/assets'

export interface AssetTreeEntry extends ComposeAssetEntry {
  readonly children?: readonly AssetTreeEntry[]
}

/**
 * 按 locale 复用的排序 collator。
 *
 * @remarks
 * `String.prototype.localeCompare(name, locale, options)` 每次调用都要按参数现场解析出一个
 * collator，而排序会调用 O(n log n) 次。复用实例是这里最便宜的一次提速。
 */
const collators = new Map<string, Intl.Collator>()

function assetCollator(locale: string) {
  const cached = collators.get(locale)
  if (cached) return cached
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  collators.set(locale, collator)
  return collator
}

function compareAssetEntries(
  collator: Intl.Collator,
  left: ComposeAssetEntry,
  right: ComposeAssetEntry,
) {
  if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1
  return collator.compare(left.name, right.name)
}

export function sortAssetEntries(
  entries: readonly ComposeAssetEntry[],
  locale: string,
) {
  const collator = assetCollator(locale)
  return [...entries].sort((left, right) => compareAssetEntries(collator, left, right))
}

/**
 * 一个目录已经物化过的子树。
 *
 * @remarks
 * 复用判据全部是引用相等：`folders` 是 Map，加载或失效一个目录只会替换那一个 key 的数组，
 * 其余目录的来源数组引用原样保留，因此没被碰到的子树可以整棵复用。
 */
interface MaterializedFolder {
  /** 该目录在父级 children 里的原始 Entry；父目录重载后它会换新对象。 */
  readonly entry: ComposeAssetEntry
  /** 该目录的直接子项来源数组。 */
  readonly source: readonly ComposeAssetEntry[] | undefined
  /** 排好序的来源；`source` 引用不变时连排序都不用重做。 */
  readonly sorted: readonly ComposeAssetEntry[] | undefined
  readonly children: readonly AssetTreeEntry[] | undefined
  readonly node: AssetTreeEntry
}

function sameChildren(
  left: readonly AssetTreeEntry[] | undefined,
  right: readonly AssetTreeEntry[] | undefined,
) {
  if (left === right) return true
  if (!left || !right || left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

/**
 * 把扁平的 `folders` Map 物化成 Tree 需要的嵌套结构，并尽量复用上一次的子树。
 *
 * @remarks
 * 全量重建的代价是 O(n log n)（每层一次排序）加上每个节点一次对象展开；两万个节点实测
 * 约 42ms，而展开任意一个目录都会触发一次。这里改成增量：递归仍然走全树（O(n) 的指针
 * 遍历很便宜），但排序与对象分配只发生在来源真正变化的那条路径上，其余子树按引用返回，
 * 下游的 `createTreeIndex` / `flattenTree` 也因此能继续命中 memo。
 *
 * `ancestors` 是一条可变的路径集合（进入时 add、退出时 delete），用来防住 provider 返回
 * 环形数据时的无限递归——每个节点各自 new 一个 Set 会把分配量放大到 O(n·depth)。
 */
function materializeTree(
  entry: ComposeAssetEntry,
  folders: ReadonlyMap<string, readonly ComposeAssetEntry[]>,
  collator: Intl.Collator,
  previous: ReadonlyMap<string, MaterializedFolder>,
  next: Map<string, MaterializedFolder>,
  ancestors: Set<string>,
): AssetTreeEntry {
  if (entry.kind !== 'folder' || ancestors.has(entry.id)) return entry
  const source = folders.get(entry.id)
  const cached = previous.get(entry.id)
  const sorted = cached && cached.source === source
    ? cached.sorted
    : source
      ? [...source].sort((left, right) => compareAssetEntries(collator, left, right))
      : undefined
  ancestors.add(entry.id)
  const children = sorted?.map(
    (child) => materializeTree(child, folders, collator, previous, next, ancestors),
  )
  ancestors.delete(entry.id)
  // Entry 本身、来源数组与全部子树都没换引用时，整棵子树原样复用。
  const reusable = cached
    && cached.entry === entry
    && cached.source === source
    && sameChildren(cached.children, children)
  const node = reusable ? cached.node : { ...entry, children }
  next.set(entry.id, { entry, source, sorted, children, node })
  return node
}

/**
 * 跨渲染保留子树缓存的物化器。
 *
 * @remarks
 * 缓存必须活过渲染，但又只影响输出的**引用**而不影响内容，因此它属于「会话实例」而不是
 * 渲染状态——与 `createStageInteractionController`、`createViewportStore` 同一类东西，
 * 由宿主 `useState` 持有一次。写成 ref 并在渲染期赋值会被 `react-hooks/refs` 正确拦下。
 *
 * @internal
 */
export interface AssetTreeMaterializer {
  /** 物化一棵树；与上一次相比没变化的子树按引用原样返回。 */
  materialize(
    root: ComposeAssetEntry,
    folders: ReadonlyMap<string, readonly ComposeAssetEntry[]>,
    locale: string,
  ): AssetTreeEntry
}

/** 创建一个持有子树缓存的物化器。 @internal */
export function createAssetTreeMaterializer(): AssetTreeMaterializer {
  let subtrees: ReadonlyMap<string, MaterializedFolder> = new Map()
  return {
    materialize(root, folders, locale) {
      const next = new Map<string, MaterializedFolder>()
      const node = materializeTree(
        root,
        folders,
        assetCollator(locale),
        subtrees,
        next,
        new Set(),
      )
      // 换成本轮走到过的目录，已经消失的目录随之出栈，缓存不会无限增长。
      subtrees = next
      return node
    },
  }
}

export function useAssetSource(provider: ComposeAssetProvider | undefined, locale: string) {
  const [folders, setFolders] = useState<ReadonlyMap<string, readonly ComposeAssetEntry[]>>(
    () => new Map(),
  )
  const [loading, setLoading] = useState<ReadonlySet<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const foldersRef = useRef<ReadonlyMap<string, readonly ComposeAssetEntry[]>>(new Map())
  const requests = useRef(new Map<string, AbortController>())

  const clear = useCallback(() => {
    for (const request of requests.current.values()) request.abort()
    requests.current.clear()
    const emptyFolders = new Map<string, readonly ComposeAssetEntry[]>()
    foldersRef.current = emptyFolders
    setFolders(emptyFolders)
    setLoading(new Set())
    setError(null)
  }, [])

  useEffect(() => clear, [clear, provider])

  const loadFolder = useCallback(async (folderId: string, force = false) => {
    if (!provider) return
    if (!force && (foldersRef.current.has(folderId) || requests.current.has(folderId))) return
    requests.current.get(folderId)?.abort()
    const controller = new AbortController()
    requests.current.set(folderId, controller)
    setLoading((current) => new Set(current).add(folderId))
    try {
      const entries = await provider.list({ folderId, signal: controller.signal })
      if (controller.signal.aborted || requests.current.get(folderId) !== controller) return
      setFolders((current) => {
        const next = new Map(current).set(folderId, entries)
        foldersRef.current = next
        return next
      })
      setError(null)
    } catch (reason) {
      if (!controller.signal.aborted) setError(normalizeComposeAssetError(reason).message)
    } finally {
      if (requests.current.get(folderId) === controller) requests.current.delete(folderId)
      setLoading((current) => {
        const next = new Set(current)
        next.delete(folderId)
        return next
      })
    }
  }, [provider])

  useEffect(() => {
    if (!provider) return
    let active = true
    queueMicrotask(() => {
      if (active) void loadFolder(provider.root.id)
    })
    return () => {
      active = false
    }
  }, [loadFolder, provider])

  useEffect(() => provider?.subscribe?.(() => {
    const loaded = [...foldersRef.current.keys()]
    for (const folderId of loaded) void loadFolder(folderId, true)
  }), [loadFolder, provider])

  const [materializer] = useState(createAssetTreeMaterializer)
  /*
   * 依赖里没有 `loading`：物化结果不再携带每目录的加载标志——那个字段没有任何消费方，
   * 却让「展开一个目录」变成两次整树重建（setLoading 增删各一次）。加载态由下面返回的
   * `loading` Set 直接查询。
   */
  const root = useMemo(
    () => provider ? materializer.materialize(provider.root, folders, locale) : null,
    [folders, locale, materializer, provider],
  )
  const entriesById = useMemo(() => {
    const entries = new Map<string, ComposeAssetEntry>()
    if (provider) entries.set(provider.root.id, provider.root)
    for (const children of folders.values()) {
      for (const entry of children) entries.set(entry.id, entry)
    }
    return entries
  }, [folders, provider])

  const invalidate = useCallback((folderIds: readonly string[]) => {
    setFolders((current) => {
      const next = new Map(current)
      for (const id of folderIds) next.delete(id)
      foldersRef.current = next
      return next
    })
    for (const id of folderIds) void loadFolder(id, true)
  }, [loadFolder])

  return {
    entriesById,
    error,
    folders,
    invalidate,
    loadFolder,
    loading,
    root,
    setError,
  }
}
