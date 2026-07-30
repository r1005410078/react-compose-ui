import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import { ComposeAssetError, normalizeComposeAssetError } from '@compose-ui/assets'
import type { ComposeAppManifest, ComposeAppManifestIssue, ComposeDocument, JsonObject } from '@compose-ui/core'
import {
  COMPOSE_APP_MANIFEST_FILE_NAME,
  COMPOSE_PAGE_MEDIA_TYPE,
  composePageDisplayName,
  createEmptyComposeAppManifest,
  createEmptyComposePageDocument,
  parseComposeAppManifest,
  parseComposePageDocument,
  serializeComposeAppManifest,
  serializeComposePageDocument,
  setComposeAppManifestHomePage,
} from '@compose-ui/core'
import type { ComposePageDescriptor } from './page-catalog'
import { listComposePageDescriptors } from './page-catalog'

/** 页面目录与首页的一次快照。 @public */
export interface ComposePageCatalog {
  readonly pages: readonly ComposePageDescriptor[]
  /** 清单指向的首页 key；未设置、清单缺失或损坏时为 null。 */
  readonly homePageKey: string | null
  /**
   * 首页 key 在当前目录中找不到对应页面。
   *
   * @remarks
   * 宿主据此提示而不清空设置 —— 一次列举失败或外部临时移动文件都不应销毁用户的首页选择。
   */
  readonly homePageMissing: boolean
  readonly manifestIssues: readonly ComposeAppManifestIssue[]
}

/** 一次读取得到的页面文档与其 Provider revision。 @public */
export interface ComposePageSnapshot {
  readonly document: ComposeDocument
  readonly revision: string
}

/** Store 向订阅者广播的变更类型。 @public */
export type ComposePageStoreEvent =
  | { readonly type: 'catalog-changed' }
  | { readonly type: 'page-changed'; readonly pageKey: string }
  | { readonly type: 'manifest-changed' }

/** {@link ComposePageStore.createPage} 的参数。 @public */
export interface CreateComposePageInput {
  /** 目标目录；null 表示资源根。 */
  readonly parentId: string | null
  /** 含页面后缀的文件名，调用方负责先用 `composePageFileName` 规范化。 */
  readonly fileName: string
  /** @defaultValue 空白页面文档 */
  readonly document?: ComposeDocument
  readonly signal?: AbortSignal
}

/**
 * 页面目录、页面文档与应用清单的事实来源。
 *
 * @remarks
 * 无 React、无 DOM。编辑器与独立预览运行时共用同一实现，因此页面加载不依赖编辑器。
 * @public
 */
export interface ComposePageStore {
  readonly providerId: string
  /**
   * 列举全部页面并读取首页指向。
   *
   * @remarks
   * 同一时刻的重复调用会被合并为一轮 Provider 列举。
   */
  listPages(signal?: AbortSignal): Promise<ComposePageCatalog>
  /**
   * 读取页面文档。
   *
   * @remarks
   * 命中缓存时不访问 Provider；同一页面的并发读取会被合并。
   * @throws {@link @compose-ui/assets#ComposeAssetError} 页面不存在或内容不合法时抛出。
   */
  readPage(pageKey: string, signal?: AbortSignal): Promise<ComposePageSnapshot>
  /**
   * 写入页面文档。
   *
   * @param expectedRevision - 期望的 Provider revision，用于乐观并发；省略时按空串处理。
   * @param force - 忽略 revision 冲突强制覆盖。
   * @throws {@link @compose-ui/assets#ComposeAssetError} `code` 为 `conflict` 表示远端已变化。
   */
  writePage(
    pageKey: string,
    document: ComposeDocument,
    expectedRevision?: string,
    force?: boolean,
  ): Promise<ComposePageDescriptor>
  createPage(input: CreateComposePageInput): Promise<ComposePageDescriptor>
  readManifest(signal?: AbortSignal): Promise<ComposeAppManifest>
  /**
   * 改写首页指向。
   *
   * @remarks
   * 清单不存在时惰性创建；写入冲突会重读一次并重试，仍失败则抛出。
   * @throws {@link @compose-ui/assets#ComposeAssetError} `code` 为 `unsupported` 表示清单不可写。
   */
  setHomePage(pageKey: string | null): Promise<ComposeAppManifest>
  /** 清单是否可写；为 false 时宿主应禁用「设为首页」。 */
  canWriteManifest(): boolean
  /** 失效缓存；省略 `pageKey` 时同时失效目录与清单。 */
  invalidate(pageKey?: string): void
  subscribe(listener: (event: ComposePageStoreEvent) => void): () => void
}

interface ManifestState {
  readonly manifest: ComposeAppManifest
  readonly unknownFields: JsonObject
  readonly entry: ComposeAssetEntry | null
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw new ComposeAssetError('io', '操作已取消', { cause: signal.reason })
  }
}

/**
 * 创建绑定到一个 Asset Provider 的页面 Store。
 *
 * @param locale - 页面排序使用的语言标签。
 * @public
 */
export function createComposePageStore(input: {
  readonly provider: ComposeAssetProvider
  readonly locale?: string
}): ComposePageStore {
  const { provider } = input
  const locale = input.locale ?? 'en'
  const listeners = new Set<(event: ComposePageStoreEvent) => void>()

  let catalogCache: ComposePageCatalog | null = null
  let catalogInFlight: Promise<ComposePageCatalog> | null = null
  let manifestCache: ManifestState | null = null
  const pageCache = new Map<string, ComposePageSnapshot>()
  const pageInFlight = new Map<string, Promise<ComposePageSnapshot>>()
  let manifestIssues: readonly ComposeAppManifestIssue[] = []

  const emit = (event: ComposePageStoreEvent) => {
    listeners.forEach((listener) => { listener(event) })
  }

  // Provider 无法告知具体变化的是哪个页面，因此保守失效全部缓存；页面文档规模小，重读代价
  // 远低于让陈旧 revision 造成假冲突。
  provider.subscribe?.(() => {
    const affected = [...pageCache.keys()]
    catalogCache = null
    manifestCache = null
    pageCache.clear()
    emit({ type: 'catalog-changed' })
    emit({ type: 'manifest-changed' })
    affected.forEach((pageKey) => { emit({ type: 'page-changed', pageKey }) })
  })

  const findDescriptor = async (
    pageKey: string,
    signal?: AbortSignal,
  ): Promise<ComposePageDescriptor> => {
    const catalog = await listPages(signal)
    const descriptor = catalog.pages.find((page) => page.pageKey === pageKey)
    if (!descriptor) {
      throw new ComposeAssetError('not-found', `页面不存在：${pageKey}`)
    }
    return descriptor
  }

  const readManifestState = async (signal?: AbortSignal): Promise<ManifestState> => {
    if (manifestCache) return manifestCache
    throwIfAborted(signal)
    let entry: ComposeAssetEntry | null
    let text: string | undefined
    try {
      const entries = await provider.list({ folderId: provider.root.id, signal })
      const found = entries.find((candidate) => candidate.kind === 'file'
        && candidate.name === COMPOSE_APP_MANIFEST_FILE_NAME) ?? null
      if (found) {
        const read = await provider.read({ fileId: found.id, signal })
        text = await read.blob.text()
        // 以 read 返回的 revision 为准：list 的 revision 可能落后于最新写入。
        entry = { ...found, revision: read.revision }
      }
      else entry = null
    }
    catch (error) {
      const normalized = normalizeComposeAssetError(error)
      // 清单读不到时按「无首页」继续：清单是纯配置，不应让资源面板整体不可用。
      if (normalized.code !== 'not-found' && normalized.code !== 'permission-denied') throw normalized
      manifestCache = { manifest: createEmptyComposeAppManifest(), unknownFields: {}, entry: null }
      return manifestCache
    }
    const parsed = parseComposeAppManifest(text)
    manifestCache = { manifest: parsed.manifest, unknownFields: parsed.unknownFields, entry }
    manifestIssues = parsed.issues
    return manifestCache
  }

  async function listPages(signal?: AbortSignal): Promise<ComposePageCatalog> {
    if (catalogCache) return catalogCache
    if (catalogInFlight) return catalogInFlight
    const request = (async () => {
      const [pages, manifestState] = await Promise.all([
        listComposePageDescriptors({ provider, locale, signal }),
        readManifestState(signal),
      ])
      const homePageKey = manifestState.manifest.homePageKey
      const catalog: ComposePageCatalog = {
        pages,
        homePageKey,
        homePageMissing: homePageKey !== null
          && !pages.some((page) => page.pageKey === homePageKey),
        manifestIssues,
      }
      catalogCache = catalog
      return catalog
    })()
    catalogInFlight = request
    try {
      return await request
    }
    finally {
      catalogInFlight = null
    }
  }

  return {
    providerId: provider.id,

    listPages,

    async readPage(pageKey, signal) {
      const cached = pageCache.get(pageKey)
      if (cached) return cached
      const inFlight = pageInFlight.get(pageKey)
      if (inFlight) return inFlight
      const request = (async () => {
        const descriptor = await findDescriptor(pageKey, signal)
        throwIfAborted(signal)
        let text: string
        let revision: string
        try {
          const read = await provider.read({ fileId: descriptor.entryId, signal })
          text = await read.blob.text()
          revision = read.revision
        }
        catch (error) {
          throw normalizeComposeAssetError(error)
        }
        const parsed = parseComposePageDocument(text)
        if (!parsed.ok) {
          throw new ComposeAssetError(
            'io',
            `页面内容不合法：${parsed.issues[0]?.message ?? '未知原因'}`,
          )
        }
        const snapshot: ComposePageSnapshot = { document: parsed.document, revision }
        pageCache.set(pageKey, snapshot)
        return snapshot
      })()
      pageInFlight.set(pageKey, request)
      try {
        return await request
      }
      finally {
        pageInFlight.delete(pageKey)
      }
    },

    async writePage(pageKey, document, expectedRevision, force) {
      const writeFile = provider.writeFile
      if (!writeFile || provider.capabilities.write === false) {
        throw new ComposeAssetError('unsupported', '当前 Provider 不支持写入页面')
      }
      const descriptor = await findDescriptor(pageKey)
      let entry: ComposeAssetEntry
      try {
        entry = await writeFile.call(provider, {
          fileId: descriptor.entryId,
          content: new Blob(
            [serializeComposePageDocument(document)],
            { type: COMPOSE_PAGE_MEDIA_TYPE },
          ),
          expectedRevision: expectedRevision ?? '',
          force,
        })
      }
      catch (error) {
        throw normalizeComposeAssetError(error)
      }
      pageCache.set(pageKey, { document, revision: entry.revision ?? '' })
      catalogCache = null
      emit({ type: 'page-changed', pageKey })
      return { ...descriptor, revision: entry.revision, modifiedAt: entry.modifiedAt }
    },

    async createPage(createInput) {
      const createFile = provider.createFile
      if (!createFile || provider.capabilities.createFile === false) {
        throw new ComposeAssetError('unsupported', '当前 Provider 不支持创建页面')
      }
      const document = createInput.document ?? createEmptyComposePageDocument()
      let entry: ComposeAssetEntry
      try {
        entry = await createFile.call(provider, {
          parentId: createInput.parentId ?? provider.root.id,
          name: createInput.fileName,
          content: new Blob(
            [serializeComposePageDocument(document)],
            { type: COMPOSE_PAGE_MEDIA_TYPE },
          ),
          signal: createInput.signal,
        })
      }
      catch (error) {
        throw normalizeComposeAssetError(error)
      }
      if (!entry.assetKey) {
        throw new ComposeAssetError(
          'unsupported',
          '页面文件缺少 assetKey，无法被引用或设为首页',
        )
      }
      catalogCache = null
      pageCache.set(entry.assetKey, { document, revision: entry.revision ?? '' })
      emit({ type: 'catalog-changed' })
      return {
        pageKey: entry.assetKey,
        entryId: entry.id,
        fileName: entry.name,
        displayName: composePageDisplayName(entry.name),
        parentId: entry.parentId,
        revision: entry.revision,
        modifiedAt: entry.modifiedAt,
      }
    },

    async readManifest(signal) {
      return (await readManifestState(signal)).manifest
    },

    async setHomePage(pageKey) {
      const writeFile = provider.writeFile
      const createFile = provider.createFile
      const state = await readManifestState()
      const next = setComposeAppManifestHomePage(state.manifest, pageKey)
      if (next === state.manifest) return next
      const text = serializeComposeAppManifest(next, state.unknownFields)
      const content = new Blob([text], { type: 'application/json' })
      if (!state.entry) {
        if (!createFile || provider.capabilities.createFile === false) {
          throw new ComposeAssetError('unsupported', '当前 Provider 不支持创建应用清单')
        }
        let created: ComposeAssetEntry
        try {
          created = await createFile.call(provider, {
            parentId: provider.root.id,
            name: COMPOSE_APP_MANIFEST_FILE_NAME,
            content,
          })
        }
        catch (error) {
          throw normalizeComposeAssetError(error)
        }
        manifestCache = { manifest: next, unknownFields: state.unknownFields, entry: created }
      }
      else {
        if (!writeFile || provider.capabilities.write === false) {
          throw new ComposeAssetError('unsupported', '当前 Provider 不支持写入应用清单')
        }
        const write = async (expectedRevision: string) => writeFile.call(provider, {
          fileId: state.entry?.id ?? '',
          content,
          expectedRevision,
        })
        let written: ComposeAssetEntry
        try {
          written = await write(state.entry.revision ?? '')
        }
        catch (error) {
          const normalized = normalizeComposeAssetError(error)
          if (normalized.code !== 'conflict') throw normalized
          // 清单只有一个字段，冲突时重读后重试一次即可；仍冲突说明有持续的外部写入者。
          manifestCache = null
          const fresh = await readManifestState()
          try {
            written = await write(fresh.entry?.revision ?? '')
          }
          catch (retryError) {
            throw normalizeComposeAssetError(retryError)
          }
        }
        manifestCache = { manifest: next, unknownFields: state.unknownFields, entry: written }
      }
      catalogCache = null
      emit({ type: 'manifest-changed' })
      return next
    },

    canWriteManifest() {
      const hasWrite = typeof provider.writeFile === 'function'
        && provider.capabilities.write !== false
      const hasCreate = typeof provider.createFile === 'function'
        && provider.capabilities.createFile !== false
      // 清单已存在时只需写入能力；尚不存在时需要创建能力。
      return manifestCache?.entry ? hasWrite : hasCreate && hasWrite
    },

    invalidate(pageKey) {
      if (pageKey === undefined) {
        catalogCache = null
        manifestCache = null
        pageCache.clear()
        emit({ type: 'catalog-changed' })
        return
      }
      pageCache.delete(pageKey)
      emit({ type: 'page-changed', pageKey })
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
