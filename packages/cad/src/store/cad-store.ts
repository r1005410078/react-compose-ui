import {
  ComposeAssetError,
  normalizeComposeAssetError,
  validateAssetName,
  type ComposeAssetEntry,
  type ComposeAssetProvider,
} from '@compose-ui/assets'
import { validateCadDocument, type CadDocument, type CadDocumentIssue } from '../document'
import {
  COMPOSE_CAD_MEDIA_TYPE,
  composeCadDisplayName,
  composeCadFileName,
  isComposeCadFileName,
  parseComposeCadDocument,
  serializeComposeCadDocument,
} from './cad-file'

/** CAD 目录中的轻量稳定描述。 @public */
export interface ComposeCadDescriptor {
  readonly entryId: string
  readonly assetKey: string
  readonly displayName: string
  readonly revision: string
}

/** 一次目录列举结果；损坏文件不会阻断其他 CAD 文档。 @public */
export interface ComposeCadCatalog {
  readonly documents: readonly ComposeCadDescriptor[]
  readonly issues: readonly {
    readonly assetKey: string
    readonly issues: readonly CadDocumentIssue[]
  }[]
}

/** CAD Store 读取的文件与 Provider revision。 @public */
export interface ComposeCadSnapshot {
  readonly document: CadDocument
  readonly revision: string
  readonly entryId: string
  readonly assetKey: string
}

/** CAD Store 事件。 @public */
export type ComposeCadStoreEvent =
  | { readonly type: 'catalog-changed' }
  | { readonly type: 'document-changed'; readonly assetKey: string }

/** 新建 CAD 文档的输入。 @public */
export interface CreateComposeCadInput {
  readonly parentId: string | null
  readonly fileName: string
  readonly document: CadDocument
  readonly signal?: AbortSignal
}

/** 项目 CAD 文档的 Provider 事实来源。 @public */
export interface ComposeCadStore {
  readonly providerId: string
  listDocuments(signal?: AbortSignal): Promise<ComposeCadCatalog>
  readDocument(assetKey: string, signal?: AbortSignal): Promise<ComposeCadSnapshot>
  createDocument(input: CreateComposeCadInput): Promise<ComposeCadSnapshot>
  saveDocument(
    assetKey: string,
    document: CadDocument,
    expectedRevision: string,
    force?: boolean,
    signal?: AbortSignal,
  ): Promise<ComposeCadSnapshot>
  invalidate(assetKey?: string): void
  subscribe(listener: (event: ComposeCadStoreEvent) => void): () => void
  /** 释放 Provider 订阅和全部缓存。 */
  dispose(): void
}

function cancellationError(signal?: AbortSignal) {
  return new ComposeAssetError('io', '操作已取消', { cause: signal?.reason })
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw cancellationError(signal)
}

/**
 * 把文档序列化成待写入的 Blob。
 *
 * @remarks
 * 写入前再校验一次而不是信任调用方：Store 是落盘前最后一道关口，非法内容一旦写进去，
 * 下次打开就是一个无法解析的文件。
 */
function cadBlob(document: CadDocument): Blob {
  const validation = validateCadDocument(document)
  if (!validation.valid) {
    throw new ComposeAssetError(
      'io',
      `拒绝写入非法 CAD 文档：${validation.issues.map(({ message }) => message).join('；')}`,
    )
  }
  return new Blob(
    [serializeComposeCadDocument(validation.document)],
    { type: COMPOSE_CAD_MEDIA_TYPE },
  )
}

/** 创建绑定一个 Asset Provider 的 CAD Store。 @public */
export function createComposeCadStore(input: {
  readonly provider: ComposeAssetProvider
  readonly locale?: string
}): ComposeCadStore {
  const { provider } = input
  const locale = input.locale ?? 'en'
  const listeners = new Set<(event: ComposeCadStoreEvent) => void>()
  const snapshots = new Map<string, ComposeCadSnapshot>()
  let catalog: ComposeCadCatalog | null = null
  let catalogInFlight: Promise<ComposeCadCatalog> | null = null
  let disposed = false
  let generation = 0

  const emit = (event: ComposeCadStoreEvent) => {
    listeners.forEach((listener) => { listener(event) })
  }

  const providerUnsubscribe = provider.subscribe?.(() => {
    if (disposed) return
    generation += 1
    const affected = [...snapshots.keys()]
    catalog = null
    catalogInFlight = null
    snapshots.clear()
    emit({ type: 'catalog-changed' })
    affected.forEach((assetKey) => { emit({ type: 'document-changed', assetKey }) })
  })

  const ensureActive = () => {
    if (disposed) throw new ComposeAssetError('io', 'CAD Store 已释放')
  }

  const readEntry = async (
    entry: ComposeAssetEntry,
    signal?: AbortSignal,
  ): Promise<ComposeCadSnapshot> => {
    if (!entry.assetKey) throw new ComposeAssetError('unsupported', `CAD 资源缺少 assetKey：${entry.name}`)
    const cached = snapshots.get(entry.assetKey)
    if (cached) return cached
    const requestGeneration = generation
    throwIfAborted(signal)
    let read: Awaited<ReturnType<ComposeAssetProvider['read']>>
    try {
      read = await provider.read({ fileId: entry.id, signal })
    }
    catch (error) {
      throw normalizeComposeAssetError(error)
    }
    const parsed = parseComposeCadDocument(await read.blob.text())
    if (!parsed.ok) {
      throw new ComposeAssetError('io', `CAD 内容不合法：${parsed.issues[0]?.message ?? '未知原因'}`)
    }
    const snapshot: ComposeCadSnapshot = {
      document: parsed.document,
      revision: read.revision,
      entryId: entry.id,
      assetKey: entry.assetKey,
    }
    // Provider 通知或显式 invalidate 发生后，迟到读取仍可返回给原调用者，但不得污染新缓存。
    if (requestGeneration === generation) snapshots.set(entry.assetKey, snapshot)
    return snapshot
  }

  const listEntries = async (
    folderId: string,
    signal?: AbortSignal,
  ): Promise<readonly ComposeAssetEntry[]> => {
    throwIfAborted(signal)
    const entries = await provider.list({ folderId, signal })
    const nested = await Promise.all(entries.map(async (entry) => (
      entry.kind === 'folder' ? listEntries(entry.id, signal) : [entry]
    )))
    return nested.flat()
  }

  async function listDocuments(signal?: AbortSignal): Promise<ComposeCadCatalog> {
    ensureActive()
    throwIfAborted(signal)
    if (catalog) return catalog
    if (catalogInFlight) return catalogInFlight
    const requestGeneration = generation
    const request = (async () => {
      const entries = (await listEntries(provider.root.id, signal))
        .filter((entry) => entry.kind === 'file' && isComposeCadFileName(entry.name) && entry.assetKey)
      const documents: ComposeCadDescriptor[] = []
      const issues: { assetKey: string; issues: readonly CadDocumentIssue[] }[] = []
      for (const entry of entries) {
        try {
          const snapshot = await readEntry(entry, signal)
          documents.push({
            entryId: entry.id,
            assetKey: snapshot.assetKey,
            displayName: composeCadDisplayName(entry.name),
            revision: snapshot.revision,
          })
        }
        catch (error) {
          issues.push({
            assetKey: entry.assetKey!,
            issues: [{
              code: 'document.invalid',
              path: [],
              message: error instanceof Error ? error.message : String(error),
            }],
          })
        }
      }
      documents.sort((a, b) => (
        a.displayName.localeCompare(b.displayName, locale)
        || a.assetKey.localeCompare(b.assetKey, locale)
      ))
      const result = { documents, issues }
      if (requestGeneration === generation) catalog = result
      return result
    })()
    catalogInFlight = request
    try {
      return await request
    }
    finally {
      if (catalogInFlight === request) catalogInFlight = null
    }
  }

  const findDescriptor = async (assetKey: string, signal?: AbortSignal) => {
    const result = await listDocuments(signal)
    const descriptor = result.documents.find((candidate) => candidate.assetKey === assetKey)
    if (!descriptor) throw new ComposeAssetError('not-found', `CAD 文档不存在：${assetKey}`)
    return descriptor
  }

  const store: ComposeCadStore = {
    providerId: provider.id,

    listDocuments,

    async readDocument(assetKey, signal) {
      ensureActive()
      throwIfAborted(signal)
      const cached = snapshots.get(assetKey)
      if (cached) return cached
      const descriptor = await findDescriptor(assetKey, signal)
      return readEntry({
        id: descriptor.entryId,
        parentId: null,
        name: composeCadFileName(descriptor.displayName),
        kind: 'file',
        mediaType: COMPOSE_CAD_MEDIA_TYPE,
        assetKey,
        revision: descriptor.revision,
      }, signal)
    },

    async createDocument(createInput) {
      ensureActive()
      throwIfAborted(createInput.signal)
      if (!provider.capabilities.createFile || !provider.createFile) {
        throw new ComposeAssetError('unsupported', 'Provider 不支持创建 CAD 文件')
      }
      const fileName = validateAssetName(composeCadFileName(createInput.fileName))
      const content = cadBlob(createInput.document)
      let entry: ComposeAssetEntry
      try {
        entry = await provider.createFile({
          parentId: createInput.parentId ?? provider.root.id,
          name: fileName,
          content,
          signal: createInput.signal,
        })
      }
      catch (error) {
        throw normalizeComposeAssetError(error)
      }
      if (!entry.assetKey) throw new ComposeAssetError('unsupported', 'Provider 创建的 CAD 文件缺少 assetKey')
      const snapshot: ComposeCadSnapshot = {
        document: structuredClone(createInput.document),
        revision: entry.revision ?? '',
        entryId: entry.id,
        assetKey: entry.assetKey,
      }
      generation += 1
      snapshots.set(entry.assetKey, snapshot)
      catalog = null
      catalogInFlight = null
      emit({ type: 'catalog-changed' })
      emit({ type: 'document-changed', assetKey: entry.assetKey })
      return snapshot
    },

    async saveDocument(assetKey, document, expectedRevision, force, signal) {
      ensureActive()
      throwIfAborted(signal)
      if (!provider.capabilities.write || !provider.writeFile) {
        throw new ComposeAssetError('unsupported', 'Provider 不支持写入 CAD 文件')
      }
      const descriptor = await findDescriptor(assetKey, signal)
      let entry: ComposeAssetEntry
      try {
        entry = await provider.writeFile({
          fileId: descriptor.entryId,
          content: cadBlob(document),
          expectedRevision,
          force,
          signal,
        })
      }
      catch (error) {
        throw normalizeComposeAssetError(error)
      }
      const snapshot: ComposeCadSnapshot = {
        document: structuredClone(document),
        revision: entry.revision ?? expectedRevision,
        entryId: entry.id,
        assetKey,
      }
      generation += 1
      snapshots.set(assetKey, snapshot)
      catalog = null
      catalogInFlight = null
      emit({ type: 'catalog-changed' })
      emit({ type: 'document-changed', assetKey })
      return snapshot
    },

    invalidate(assetKey) {
      ensureActive()
      generation += 1
      catalog = null
      catalogInFlight = null
      if (assetKey) snapshots.delete(assetKey)
      else snapshots.clear()
    },

    subscribe(listener) {
      ensureActive()
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    dispose() {
      if (disposed) return
      disposed = true
      generation += 1
      providerUnsubscribe?.()
      listeners.clear()
      snapshots.clear()
      catalog = null
      catalogInFlight = null
    },
  }
  return store
}
