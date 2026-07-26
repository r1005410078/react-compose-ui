import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import { normalizeComposeAssetError } from '@compose-ui/assets'

export interface AssetTreeEntry extends ComposeAssetEntry {
  readonly children?: readonly AssetTreeEntry[]
  readonly loading?: boolean
}

export function sortAssetEntries(
  entries: readonly ComposeAssetEntry[],
  locale: string,
) {
  return [...entries].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1
    return left.name.localeCompare(right.name, locale, { numeric: true, sensitivity: 'base' })
  })
}

function materializeTree(
  entry: ComposeAssetEntry,
  folders: ReadonlyMap<string, readonly ComposeAssetEntry[]>,
  loading: ReadonlySet<string>,
  locale: string,
  ancestors: ReadonlySet<string> = new Set(),
): AssetTreeEntry {
  if (entry.kind !== 'folder' || ancestors.has(entry.id)) return entry
  const nextAncestors = new Set(ancestors).add(entry.id)
  const children = folders.get(entry.id)
  return {
    ...entry,
    loading: loading.has(entry.id),
    children: children
      ? sortAssetEntries(children, locale)
        .map((child) => materializeTree(child, folders, loading, locale, nextAncestors))
      : undefined,
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

  const root = useMemo(
    () => provider ? materializeTree(provider.root, folders, loading, locale) : null,
    [folders, loading, locale, provider],
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
