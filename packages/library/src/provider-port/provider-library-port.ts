import {
  ComposeAssetError,
  normalizeComposeAssetError,
  type ComposeAssetEntry,
  type ComposeAssetProvider,
} from '@compose-ui/assets'
import {
  composePageFileName,
  createEmptyComposePageFile,
  serializeComposePageFile,
  COMPOSE_PAGE_MEDIA_TYPE,
} from '@compose-ui/core'
import type {
  ComposeLibraryCategory,
  ComposeLibraryCreateInput,
  ComposeLibraryInstantiateInput,
  ComposeLibraryKeysInput,
  ComposeLibraryPage,
  ComposeLibraryPort,
  ComposeLibraryQuery,
  ComposeLibraryRecord,
  ComposeLibraryThumbnailInput,
  ComposeLibraryUpdateInput,
} from '../port/library-types'
import {
  COMPOSE_LIBRARY_FILE_NAME,
  COMPOSE_LIBRARY_MEDIA_TYPE,
  COMPOSE_LIBRARY_THUMBNAIL_FOLDER,
  createEmptyComposeLibraryFile,
  parseComposeLibraryFile,
  serializeComposeLibraryFile,
  type ComposeLibraryFile,
  type ComposeLibraryFileRecord,
} from './library-file'
import {
  computeComposeLibraryFacets,
  matchesComposeLibraryQuery,
  paginateComposeLibraryRecords,
  sortComposeLibraryRecords,
} from './library-query'

/**
 * 目录里一个页面的最小描述。
 *
 * @remarks
 * 结构上与 `@compose-ui/pages` 的 `ComposePageDescriptor` 兼容，因此宿主直接把
 * `listComposePageDescriptors` 传进来即可。本包**不依赖 `pages`**：那个包还装着运行时导航，
 * 而首页是一个可以完全不加载编辑器的宿主。
 * @public
 */
export interface ComposeLibraryPageDescriptor {
  readonly pageKey: string
  readonly entryId: string
  readonly fileName: string
  readonly displayName: string
  readonly parentId: string | null
  readonly revision?: string
  readonly modifiedAt?: number
}

/** @public */
export interface CreateProviderLibraryPortOptions {
  readonly provider: ComposeAssetProvider
  /**
   * 列举目录树里的全部页面。
   *
   * @remarks
   * **由调用方注入**而不是本包自己遍历：这趟 BFS 已经住在 `@compose-ui/pages` 里，而两个包
   * 之间没有依赖关系，各写一份的症状是「两处对『什么算一个页面』的判断分家」。
   */
  readonly listPages: (input: {
    readonly provider: ComposeAssetProvider
    readonly signal?: AbortSignal
  }) => Promise<readonly ComposeLibraryPageDescriptor[]>
  /** 排序用的语言标签。 */
  readonly locale?: string
  /** 新页面的落点；缺席即 Provider 根。 */
  readonly defaultFolderId?: string
  /** 取当前时刻；用例可注入。 */
  readonly now?: () => number
}

interface LibraryState {
  readonly descriptors: readonly ComposeLibraryPageDescriptor[]
  readonly file: ComposeLibraryFile
  readonly records: readonly ComposeLibraryRecord[]
}

const DEFAULT_FILE_RECORD: ComposeLibraryFileRecord = {
  kind: 'project',
  categories: [],
  useCount: 0,
  deletedAt: null,
}

function toRecord(
  descriptor: ComposeLibraryPageDescriptor,
  stored: ComposeLibraryFileRecord | undefined,
): ComposeLibraryRecord {
  // 库文件里**没有记录的页面按默认值出现**，不要求先注册：用户手动往目录里放一份 `.page.json`，
  // 它照样要出现在库里——要求注册等于让一份合法的页面文件在首页上凭空消失。
  const record = stored ?? DEFAULT_FILE_RECORD
  const modifiedAt = descriptor.modifiedAt ?? 0
  return {
    pageKey: descriptor.pageKey,
    title: descriptor.displayName,
    kind: record.kind,
    categories: record.categories,
    // 本地 Provider 给不出 URL；缩略图字节走 `readThumbnail`，由组件持有 objectURL 的生命周期。
    thumbnailUrl: null,
    // 尺寸要读页面文档才知道。为了首页那一屏去解析几百份文档，正是这个端口存在的理由所反对的；
    // 它留给能在服务端一并存下来的实现。
    width: null,
    height: null,
    useCount: record.useCount,
    deletedAt: record.deletedAt,
    createdAt: record.createdAt ?? modifiedAt,
    modifiedAt,
    ...(descriptor.revision === undefined ? {} : { revisionHint: descriptor.revision }),
  }
}

function thumbnailFileName(pageKey: string) {
  // pageKey 是不透明 id，可能含路径分隔符或别的不能进文件名的字符。
  return `${encodeURIComponent(pageKey)}.png`
}

/**
 * 用现有的 `ComposeAssetProvider` 顶起页面库端口。
 *
 * @remarks
 * 这是「现在没有后端」这句话的落点：前端整条流程今天就跑得通，后端到了只换端口的实现。
 *
 * Provider 答不了的业务字段（性质、场景类型、使用次数、删除状态）落在根目录一份
 * `library.json` 里；标题、修改时间与 revision **不进那份文件**——它们在资源条目上，存两份
 * 必然漂移。
 *
 * 代价写在明处：那份文件是**整份重写**的，两个标签页同时改会互相覆盖。本地单人用可接受，
 * 这也正是它只是过渡实现的原因。
 *
 * @throws {@link @compose-ui/assets#ComposeAssetError}
 * @public
 */
export function createProviderLibraryPort(
  options: CreateProviderLibraryPortOptions,
): ComposeLibraryPort {
  const { provider, listPages } = options
  const locale = options.locale ?? 'zh-CN'
  const now = options.now ?? (() => Date.now())
  const listeners = new Set<() => void>()
  let cache: LibraryState | null = null
  let pending: Promise<LibraryState> | null = null

  function invalidate() {
    cache = null
    pending = null
  }

  function notify() {
    for (const listener of [...listeners]) listener()
  }

  const unsubscribeProvider = provider.subscribe?.(() => {
    invalidate()
    notify()
  })
  // 本地实现不持有别的资源，因此没有 dispose：订阅由订阅方卸载时自己移除，
  // 而这一条订阅随 Provider 生命周期走。
  void unsubscribeProvider

  async function findRootEntry(name: string, signal?: AbortSignal) {
    const entries = await provider.list({ folderId: provider.root.id, signal })
    return entries.find((entry) => entry.kind === 'file' && entry.name === name) ?? null
  }

  async function readLibraryFile(signal?: AbortSignal): Promise<{
    readonly file: ComposeLibraryFile
    readonly entry: ComposeAssetEntry | null
    readonly revision: string
  }> {
    const entry = await findRootEntry(COMPOSE_LIBRARY_FILE_NAME, signal)
    if (entry === null) return { file: createEmptyComposeLibraryFile(), entry: null, revision: '' }
    const { blob, revision } = await provider.read({ fileId: entry.id, signal })
    return { file: parseComposeLibraryFile(await blob.text()), entry, revision }
  }

  async function writeLibraryFile(file: ComposeLibraryFile, signal?: AbortSignal) {
    const content = new Blob([serializeComposeLibraryFile(file)], {
      type: COMPOSE_LIBRARY_MEDIA_TYPE,
    })
    const entry = await findRootEntry(COMPOSE_LIBRARY_FILE_NAME, signal)
    if (entry === null) {
      if (provider.createFile === undefined) {
        throw new ComposeAssetError('unsupported', 'Provider cannot create the library file')
      }
      await provider.createFile({
        parentId: provider.root.id,
        name: COMPOSE_LIBRARY_FILE_NAME,
        content,
        signal,
      })
    }
    else {
      if (provider.writeFile === undefined) {
        throw new ComposeAssetError('unsupported', 'Provider cannot write the library file')
      }
      const { revision } = await provider.read({ fileId: entry.id, signal })
      await provider.writeFile({ fileId: entry.id, content, expectedRevision: revision, signal })
    }
    invalidate()
    notify()
  }

  /** 读—改—写一次库文件。整份重写是这个实现已知的并发代价，见工厂函数的说明。 */
  async function mutateLibraryFile(
    mutate: (file: ComposeLibraryFile) => ComposeLibraryFile,
    signal?: AbortSignal,
  ) {
    const { file } = await readLibraryFile(signal)
    await writeLibraryFile(mutate(file), signal)
  }

  async function loadState(signal?: AbortSignal): Promise<LibraryState> {
    if (cache !== null) return cache
    if (pending !== null) return pending
    pending = (async () => {
      try {
        const [descriptors, { file }] = await Promise.all([
          listPages({ provider, signal }),
          readLibraryFile(signal),
        ])
        const records = descriptors.map((descriptor) => (
          toRecord(descriptor, file.records[descriptor.pageKey])
        ))
        const state: LibraryState = { descriptors, file, records }
        cache = state
        return state
      }
      catch (error) {
        throw normalizeComposeAssetError(error)
      }
      finally {
        pending = null
      }
    })()
    return pending
  }

  function categoryIdsOf(state: LibraryState): readonly string[] {
    const declared = state.file.categories.map((category) => category.id)
    const seen = new Set(declared)
    const extra: string[] = []
    // 记录上有、清单里没有的标签照样列出来——否则它们的图数不进任何一格，左栏的和对不上总数。
    for (const record of state.records) {
      for (const id of record.categories) {
        if (!seen.has(id)) {
          seen.add(id)
          extra.push(id)
        }
      }
    }
    extra.sort((left, right) => left.localeCompare(right, locale))
    return [...declared, ...extra]
  }

  async function requireRecord(pageKey: string, signal?: AbortSignal) {
    const state = await loadState(signal)
    const record = state.records.find((candidate) => candidate.pageKey === pageKey)
    if (record === undefined) {
      throw new ComposeAssetError('not-found', `Library record "${pageKey}" was not found`)
    }
    return { state, record }
  }

  async function createPageFile(input: {
    readonly title: string
    readonly content: Blob
    readonly folderId: string | undefined
    readonly signal?: AbortSignal
  }) {
    if (provider.createFile === undefined) {
      throw new ComposeAssetError('unsupported', 'Provider cannot create files')
    }
    const entry = await provider.createFile({
      parentId: input.folderId ?? options.defaultFolderId ?? provider.root.id,
      name: composePageFileName(input.title),
      content: input.content,
      signal: input.signal,
    })
    if (entry.assetKey === undefined) {
      // 没有稳定 key 的页面无法被引用、设为首页或记进库文件——它一进库就是一条解析不了的引用。
      throw new ComposeAssetError(
        'unsupported',
        'Provider created a page without a stable assetKey',
      )
    }
    return entry as ComposeAssetEntry & { readonly assetKey: string }
  }

  const capabilities = {
    create: provider.capabilities.createFile,
    update: provider.capabilities.write,
    trash: provider.capabilities.write,
    purge: provider.capabilities.delete && provider.capabilities.write,
    thumbnail: provider.capabilities.createFile,
    recents: provider.capabilities.write,
  } as const

  const port: ComposeLibraryPort = {
    id: `${provider.id}:library`,
    capabilities,

    async query(query: ComposeLibraryQuery): Promise<ComposeLibraryPage> {
      const state = await loadState(query.signal)
      const matched = state.records.filter((record) => matchesComposeLibraryQuery(record, query))
      const sorted = sortComposeLibraryRecords(matched, query.sort, locale)
      const { items, nextCursor } = paginateComposeLibraryRecords(sorted, query.cursor, query.limit)
      // facet 与 items 出自同一次加载：分两次取会让用户改一次筛选就看到计数是旧的、图是新的。
      const facets = computeComposeLibraryFacets({
        records: state.records,
        query,
        categoryIds: categoryIdsOf(state),
      })
      return { items, nextCursor, facets }
    },

    async get({ pageKey, signal }) {
      const { record } = await requireRecord(pageKey, signal)
      return record
    },

    async listCategories(input): Promise<readonly ComposeLibraryCategory[]> {
      const state = await loadState(input?.signal)
      const declared = new Map(state.file.categories.map((category) => [category.id, category]))
      return categoryIdsOf(state).map((id) => declared.get(id) ?? { id, label: id })
    },

    async create(input: ComposeLibraryCreateInput) {
      const content = input.content ?? new Blob(
        [serializeComposePageFile(createEmptyComposePageFile())],
        { type: COMPOSE_PAGE_MEDIA_TYPE },
      )
      const entry = await createPageFile({
        title: input.title,
        content,
        folderId: input.folderId,
        signal: input.signal,
      })
      const createdAt = now()
      await mutateLibraryFile((file) => ({
        ...file,
        records: {
          ...file.records,
          [entry.assetKey]: {
            kind: input.kind,
            categories: input.categories ?? [],
            useCount: 0,
            deletedAt: null,
            createdAt,
          },
        },
      }), input.signal)
      const { record } = await requireRecord(entry.assetKey, input.signal)
      return record
    },

    async instantiate(input: ComposeLibraryInstantiateInput) {
      const { state, record: source } = await requireRecord(input.sourcePageKey, input.signal)
      const descriptor = state.descriptors.find((item) => item.pageKey === input.sourcePageKey)
      if (descriptor === undefined) {
        throw new ComposeAssetError('not-found', `Page "${input.sourcePageKey}" was not found`)
      }
      // 本地实现只能把字节读进内存再写出去——服务端那一份走 server-side copy。这是这条实现
      // 已知的降级，不是协议的语义。
      const { blob } = await provider.read({ fileId: descriptor.entryId, signal: input.signal })
      const entry = await createPageFile({
        title: input.title,
        content: blob,
        folderId: input.folderId ?? descriptor.parentId ?? undefined,
        signal: input.signal,
      })
      const createdAt = now()
      await mutateLibraryFile((file) => {
        const storedSource = file.records[input.sourcePageKey] ?? {
          kind: source.kind,
          categories: source.categories,
          useCount: source.useCount,
          deletedAt: source.deletedAt,
        }
        return {
          ...file,
          records: {
            ...file.records,
            // 「就用这个」与「来源被用了一次」是同一件事的两半，因此写在同一次里。
            [input.sourcePageKey]: { ...storedSource, useCount: storedSource.useCount + 1 },
            [entry.assetKey]: {
              // 默认 'project' 而不是继承来源：按下那一下的意思是拿模板做一张要交付的图。
              kind: input.kind ?? 'project',
              categories: input.categories ?? source.categories,
              useCount: 0,
              deletedAt: null,
              createdAt,
            },
          },
        }
      }, input.signal)
      const { record } = await requireRecord(entry.assetKey, input.signal)
      return record
    },

    async update(input: ComposeLibraryUpdateInput) {
      const { state, record } = await requireRecord(input.pageKey, input.signal)
      if (input.title !== undefined && input.title !== record.title) {
        if (provider.renameEntry === undefined) {
          throw new ComposeAssetError('unsupported', 'Provider cannot rename entries')
        }
        const descriptor = state.descriptors.find((item) => item.pageKey === input.pageKey)
        if (descriptor !== undefined) {
          // 标题住在文件名上，不进库文件：存两份必然漂移。
          await provider.renameEntry({
            entryId: descriptor.entryId,
            name: composePageFileName(input.title),
            signal: input.signal,
          })
        }
      }
      await mutateLibraryFile((file) => {
        const stored = file.records[input.pageKey] ?? {
          kind: record.kind,
          categories: record.categories,
          useCount: record.useCount,
          deletedAt: record.deletedAt,
          createdAt: record.createdAt,
        }
        return {
          ...file,
          records: {
            ...file.records,
            [input.pageKey]: {
              ...stored,
              ...(input.kind === undefined ? {} : { kind: input.kind }),
              ...(input.categories === undefined ? {} : { categories: input.categories }),
            },
          },
        }
      }, input.signal)
      const updated = await requireRecord(input.pageKey, input.signal)
      return updated.record
    },

    async trash(input: ComposeLibraryKeysInput) {
      const deletedAt = now()
      // 软删除**不动页面文件**：移动会改 entry id，而且用户在资源浏览器里会看见自己的文件
      // 凭空消失。
      await setDeletedAt(input, deletedAt)
    },

    async restore(input: ComposeLibraryKeysInput) {
      await setDeletedAt(input, null)
    },

    async purge(input: ComposeLibraryKeysInput) {
      if (provider.deleteEntry === undefined) {
        throw new ComposeAssetError('unsupported', 'Provider cannot delete entries')
      }
      const state = await loadState(input.signal)
      for (const pageKey of input.pageKeys) {
        const descriptor = state.descriptors.find((item) => item.pageKey === pageKey)
        if (descriptor === undefined) continue
        await provider.deleteEntry({ entryId: descriptor.entryId, signal: input.signal })
      }
      await mutateLibraryFile((file) => {
        const records = { ...file.records }
        for (const pageKey of input.pageKeys) delete records[pageKey]
        return {
          ...file,
          records,
          recents: (file.recents ?? []).filter((key) => !input.pageKeys.includes(key)),
        }
      }, input.signal)
    },

    async putThumbnail(input: ComposeLibraryThumbnailInput) {
      const folder = await ensureThumbnailFolder(input.signal)
      const name = thumbnailFileName(input.pageKey)
      const entries = await provider.list({ folderId: folder.id, signal: input.signal })
      const existing = entries.find((entry) => entry.kind === 'file' && entry.name === name)
      if (existing === undefined) {
        if (provider.createFile === undefined) {
          throw new ComposeAssetError('unsupported', 'Provider cannot create files')
        }
        await provider.createFile({
          parentId: folder.id,
          name,
          content: input.image,
          signal: input.signal,
        })
        return
      }
      if (provider.writeFile === undefined) {
        throw new ComposeAssetError('unsupported', 'Provider cannot write files')
      }
      const { revision } = await provider.read({ fileId: existing.id, signal: input.signal })
      await provider.writeFile({
        fileId: existing.id,
        content: input.image,
        expectedRevision: revision,
        signal: input.signal,
      })
    },

    async readThumbnail({ pageKey, signal }) {
      const folder = await findRootFolder(COMPOSE_LIBRARY_THUMBNAIL_FOLDER, signal)
      if (folder === null) return null
      const entries = await provider.list({ folderId: folder.id, signal })
      const entry = entries.find((item) => (
        item.kind === 'file' && item.name === thumbnailFileName(pageKey)
      ))
      // 还没有缩略图是常态，不是失败——首页在这一档画占位。
      if (entry === undefined) return null
      const { blob } = await provider.read({ fileId: entry.id, signal })
      return { blob, mediaType: entry.mediaType ?? 'image/png' }
    },

    async recordOpen({ pageKey, signal }) {
      await mutateLibraryFile((file) => ({
        ...file,
        recents: [pageKey, ...(file.recents ?? []).filter((key) => key !== pageKey)].slice(0, 50),
      }), signal)
    },

    async listRecents(input) {
      const state = await loadState(input?.signal)
      const limit = Math.max(1, Math.trunc(input?.limit ?? 12))
      const byKey = new Map(state.records.map((record) => [record.pageKey, record]))
      return (state.file.recents ?? [])
        .map((pageKey) => byKey.get(pageKey))
        .filter((record): record is ComposeLibraryRecord => (
          // 已经删掉或进了回收站的不出现在「最近打开」里：那一栏回答「回到刚才那张」。
          record !== undefined && record.deletedAt === null
        ))
        .slice(0, limit)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  async function findRootFolder(name: string, signal?: AbortSignal) {
    const entries = await provider.list({ folderId: provider.root.id, signal })
    return entries.find((entry) => entry.kind === 'folder' && entry.name === name) ?? null
  }

  async function ensureThumbnailFolder(signal?: AbortSignal) {
    const existing = await findRootFolder(COMPOSE_LIBRARY_THUMBNAIL_FOLDER, signal)
    if (existing !== null) return existing
    if (provider.createFolder === undefined) {
      throw new ComposeAssetError('unsupported', 'Provider cannot create folders')
    }
    return provider.createFolder({
      parentId: provider.root.id,
      name: COMPOSE_LIBRARY_THUMBNAIL_FOLDER,
      signal,
    })
  }

  async function setDeletedAt(input: ComposeLibraryKeysInput, deletedAt: number | null) {
    const state = await loadState(input.signal)
    await mutateLibraryFile((file) => {
      const records = { ...file.records }
      for (const pageKey of input.pageKeys) {
        const current = state.records.find((record) => record.pageKey === pageKey)
        if (current === undefined) continue
        const stored = records[pageKey] ?? {
          // 恢复必须回到它原来的性质，因此这里绝不能把 kind 归一成某个默认值。
          kind: current.kind,
          categories: current.categories,
          useCount: current.useCount,
          deletedAt: current.deletedAt,
          createdAt: current.createdAt,
        }
        records[pageKey] = { ...stored, deletedAt }
      }
      return { ...file, records }
    }, input.signal)
  }

  return port
}
