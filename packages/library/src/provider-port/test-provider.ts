import { ComposeAssetError, type ComposeAssetEntry, type ComposeAssetProvider } from '@compose-ui/assets'
import { COMPOSE_PAGE_MEDIA_TYPE, composePageDisplayName, isComposePageMediaType } from '@compose-ui/core'
import type { ComposeLibraryPageDescriptor } from './provider-library-port'

interface StoredEntry {
  entry: ComposeAssetEntry
  text: string
}

/**
 * 用例夹具：一个最小的内存 Provider。
 *
 * @remarks
 * `assetKey` 由它**签发**且与 `id` 同值——这正是对象存储那一侧的形状（名字与父级住表里，
 * 对象 key 是不透明 id），因此重命名不改 key。
 * @internal
 */
export function createMemoryProvider(options?: { readonly now?: () => number }) {
  const now = options?.now ?? (() => 1_000)
  const entries = new Map<string, StoredEntry>()
  const listeners = new Set<() => void>()
  let seed = 0

  const root: ComposeAssetEntry = { id: 'root', parentId: null, name: 'Library', kind: 'folder' }

  function emit() {
    for (const listener of [...listeners]) listener()
  }

  function put(input: {
    readonly parentId: string
    readonly name: string
    readonly text: string
    readonly kind: 'file' | 'folder'
  }) {
    seed += 1
    const id = `e${seed}`
    const mediaType = input.name.endsWith('.page.json')
      ? COMPOSE_PAGE_MEDIA_TYPE
      : input.name.endsWith('.png') ? 'image/png' : 'application/json'
    const entry: ComposeAssetEntry = {
      id,
      parentId: input.parentId,
      name: input.name,
      kind: input.kind,
      modifiedAt: now(),
      revision: `r${seed}`,
      ...(input.kind === 'file' ? { mediaType, assetKey: id, size: input.text.length } : {}),
    }
    entries.set(id, { entry, text: input.text })
    emit()
    return entry
  }

  const provider: ComposeAssetProvider = {
    id: 'memory',
    label: 'Memory',
    root,
    referenceScope: 'persistent',
    capabilities: {
      createFile: true,
      createFolder: true,
      rename: true,
      move: true,
      delete: true,
      write: true,
      reference: true,
    },
    async list({ folderId }) {
      return [...entries.values()]
        .filter((stored) => stored.entry.parentId === folderId)
        .map((stored) => stored.entry)
    },
    async read({ fileId }) {
      const stored = entries.get(fileId)
      if (stored === undefined) throw new ComposeAssetError('not-found', fileId)
      return { blob: new Blob([stored.text]), revision: stored.entry.revision ?? '' }
    },
    async createFile({ parentId, name, content }) {
      const existing = [...entries.values()].find((stored) => (
        stored.entry.parentId === parentId && stored.entry.name === name
      ))
      if (existing !== undefined) throw new ComposeAssetError('conflict', name)
      return put({ parentId, name, text: await content.text(), kind: 'file' })
    },
    async createFolder({ parentId, name }) {
      return put({ parentId, name, text: '', kind: 'folder' })
    },
    async writeFile({ fileId, content, expectedRevision }) {
      const stored = entries.get(fileId)
      if (stored === undefined) throw new ComposeAssetError('not-found', fileId)
      if (stored.entry.revision !== expectedRevision) {
        throw new ComposeAssetError('conflict', fileId)
      }
      seed += 1
      stored.text = await content.text()
      stored.entry = { ...stored.entry, revision: `r${seed}`, modifiedAt: now() }
      emit()
      return stored.entry
    },
    async renameEntry({ entryId, name }) {
      const stored = entries.get(entryId)
      if (stored === undefined) throw new ComposeAssetError('not-found', entryId)
      // 改名不改 assetKey——这正是「身份不是路径」那条在夹具里的形式。
      stored.entry = { ...stored.entry, name }
      emit()
      return stored.entry
    },
    async deleteEntry({ entryId }) {
      entries.delete(entryId)
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  /** 与 `listComposePageDescriptors` 结构兼容的最小实现。 */
  async function listPages(): Promise<readonly ComposeLibraryPageDescriptor[]> {
    return [...entries.values()]
      .filter((stored) => (
        isComposePageMediaType(stored.entry.mediaType) && stored.entry.assetKey !== undefined
      ))
      .map((stored) => ({
        pageKey: stored.entry.assetKey as string,
        entryId: stored.entry.id,
        fileName: stored.entry.name,
        displayName: composePageDisplayName(stored.entry.name),
        parentId: stored.entry.parentId,
        ...(stored.entry.revision === undefined ? {} : { revision: stored.entry.revision }),
        ...(stored.entry.modifiedAt === undefined ? {} : { modifiedAt: stored.entry.modifiedAt }),
      }))
  }

  return {
    provider,
    listPages,
    seedPage(name: string, text = '{}') {
      return put({ parentId: root.id, name, text, kind: 'file' })
    },
    seedFile(name: string, text: string) {
      return put({ parentId: root.id, name, text, kind: 'file' })
    },
    textOf(entryId: string) {
      return entries.get(entryId)?.text
    },
    has(entryId: string) {
      return entries.has(entryId)
    },
  }
}
