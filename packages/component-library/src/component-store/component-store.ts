import {
  ComposeAssetError,
  normalizeComposeAssetError,
  validateAssetName,
  type ComposeAssetEntry,
  type ComposeAssetProvider,
} from '@compose-ui/assets'
import {
  COMPOSE_COMPONENT_MEDIA_TYPE,
  composeComponentFileName,
  isComposeComponentFileName,
  isComposeComponentMediaType,
  parseComposeComponentAsset,
  resolveComposeComponentAsset,
  serializeComposeComponentAsset,
  type ComposeComponentAssetIssue,
  type ComposeComponentAssetV1,
  type ComposeComponentReference,
  type ComposeComponentResolveResult,
} from '@compose-ui/core'

/** 组件目录中的轻量稳定描述。 @public */
export interface ComposeComponentDescriptor {
  readonly entryId: string
  readonly assetKey: string
  readonly displayName: string
  readonly componentId: string
  readonly kind: ComposeComponentAssetV1['kind']
  readonly revision: string
  readonly reference: ComposeComponentReference
  /**
   * 组件文件所在文件夹，从 Provider 根往下的各级名称；直接躺在根下时是空数组。
   *
   * @remarks
   * 物料面板的货架按**文件夹**取材（选文件夹不选文件），因此分类这件事的事实来源是资源树
   * 而不是组件文件里的某个字段。路径由 Store 顺着 `parentId` 链（列举时逐层下钻的那条链）
   * 推出，组件协议一个字节不改。
   */
  readonly folderPath: readonly string[]
}

/** 一次目录列举结果；损坏文件不会阻断其他组件。 @public */
export interface ComposeComponentCatalog {
  readonly components: readonly ComposeComponentDescriptor[]
  readonly issues: readonly {
    readonly assetKey: string
    readonly issues: readonly ComposeComponentAssetIssue[]
  }[]
  /**
   * Provider 根之下的全部文件夹路径（不含根自己）。
   *
   * @remarks
   * 货架要分得清「这个文件夹是空的」与「这个文件夹没了」——只看组件的 `folderPath` 两者都是
   * 一个都没有。列举本来就要逐层下钻，顺手记下路径不多走一趟 Provider。
   */
  readonly folders: readonly (readonly string[])[]
}

/** Component Store 读取的文件与 Provider revision。 @public */
export interface ComposeComponentSnapshot {
  readonly asset: ComposeComponentAssetV1
  readonly revision: string
  readonly entryId: string
  readonly assetKey: string
}

/** Component Store 事件。 @public */
export type ComposeComponentStoreEvent =
  | { readonly type: 'catalog-changed' }
  | { readonly type: 'component-changed'; readonly assetKey: string }

/** 新建 Component Asset 的输入。 @public */
export interface CreateComposeComponentInput {
  readonly parentId: string | null
  readonly fileName: string
  readonly asset: ComposeComponentAssetV1
  readonly signal?: AbortSignal
}

/** 项目 Component Asset 的 Provider 事实来源。 @public */
export interface ComposeComponentStore {
  readonly providerId: string
  /** 为当前 Store Provider 构造稳定资源引用。 */
  createReference(assetKey: string): ComposeComponentReference
  listComponents(signal?: AbortSignal): Promise<ComposeComponentCatalog>
  readComponent(assetKey: string, signal?: AbortSignal): Promise<ComposeComponentSnapshot>
  createComponent(input: CreateComposeComponentInput): Promise<ComposeComponentSnapshot>
  saveComponent(
    assetKey: string,
    asset: ComposeComponentAssetV1,
    expectedRevision: string,
    force?: boolean,
    signal?: AbortSignal,
  ): Promise<ComposeComponentSnapshot>
  resolveComponent(
    reference: ComposeComponentReference,
    signal?: AbortSignal,
  ): Promise<ComposeComponentResolveResult>
  invalidate(assetKey?: string): void
  subscribe(listener: (event: ComposeComponentStoreEvent) => void): () => void
  /** 释放 Provider 订阅和全部缓存。 */
  dispose(): void
}

function cancellationError(signal?: AbortSignal) {
  return new ComposeAssetError('io', '操作已取消', { cause: signal?.reason })
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw cancellationError(signal)
}

function displayName(name: string) {
  return isComposeComponentFileName(name)
    ? name.slice(0, -'.component.json'.length)
    : name
}

function componentBlob(asset: ComposeComponentAssetV1): Blob {
  const text = serializeComposeComponentAsset(asset)
  const validation = parseComposeComponentAsset(text)
  if (!validation.ok) {
    throw new ComposeAssetError(
      'io',
      `拒绝写入非法组件：${validation.issues.map(({ message }) => message).join('；')}`,
    )
  }
  return new Blob([text], { type: COMPOSE_COMPONENT_MEDIA_TYPE })
}

/** 创建绑定一个 Asset Provider 的 Component Store。 @public */
export function createComposeComponentStore(input: {
  readonly provider: ComposeAssetProvider
  readonly locale?: string
}): ComposeComponentStore {
  const { provider } = input
  const locale = input.locale ?? 'en'
  const listeners = new Set<(event: ComposeComponentStoreEvent) => void>()
  const snapshots = new Map<string, ComposeComponentSnapshot>()
  let catalog: ComposeComponentCatalog | null = null
  let catalogInFlight: Promise<ComposeComponentCatalog> | null = null
  let disposed = false
  let generation = 0

  const emit = (event: ComposeComponentStoreEvent) => {
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
    affected.forEach((assetKey) => { emit({ type: 'component-changed', assetKey }) })
  })

  const ensureActive = () => {
    if (disposed) throw new ComposeAssetError('io', 'Component Store 已释放')
  }

  const referenceFor = (assetKey: string): ComposeComponentReference => ({
    kind: 'component',
    providerId: provider.id,
    assetKey,
    scope: provider.referenceScope ?? 'persistent',
  })

  const readEntry = async (
    entry: ComposeAssetEntry,
    signal?: AbortSignal,
  ): Promise<ComposeComponentSnapshot> => {
    if (!entry.assetKey) throw new ComposeAssetError('unsupported', `组件资源缺少 assetKey：${entry.name}`)
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
    const parsed = parseComposeComponentAsset(await read.blob.text())
    if (!parsed.ok) {
      throw new ComposeAssetError('io', `组件内容不合法：${parsed.issues[0]?.message ?? '未知原因'}`)
    }
    const snapshot: ComposeComponentSnapshot = {
      asset: parsed.asset,
      revision: read.revision,
      entryId: entry.id,
      assetKey: entry.assetKey,
    }
    // Provider 通知或显式 invalidate 发生后，迟到读取仍可返回给原调用者，但不得污染新缓存。
    if (requestGeneration === generation) snapshots.set(entry.assetKey, snapshot)
    return snapshot
  }

  /** 一个文件连同它所在文件夹的路径；路径是逐层下钻时攒出来的那条 `parentId` 链。 */
  interface WalkedEntry {
    readonly entry: ComposeAssetEntry
    readonly folderPath: readonly string[]
  }

  const listEntries = async (
    folderId: string,
    folderPath: readonly string[],
    folders: (readonly string[])[],
    signal?: AbortSignal,
  ): Promise<readonly WalkedEntry[]> => {
    throwIfAborted(signal)
    const entries = await provider.list({ folderId, signal })
    const nested = await Promise.all(entries.map(async (entry) => {
      if (entry.kind !== 'folder') return [{ entry, folderPath }]
      const childPath = [...folderPath, entry.name]
      folders.push(childPath)
      return listEntries(entry.id, childPath, folders, signal)
    }))
    return nested.flat()
  }

  /**
   * 列举目录。
   *
   * @remarks
   * 并发调用共用同一个在飞的请求，但请求体**不接任何调用方的 signal**：取消是调用方自己的事，
   * 共享的那份活儿要跑完并把结果缓存给所有人。反过来（把第一个调用方的 signal 传进去）的症状
   * 很具体——React StrictMode 的挂载→清理→再挂载里，第一次挂载在清理时 abort，第二次挂载拿到
   * 的却是**同一个**已经注定要以「操作已取消」失败的 promise，而它自己的 signal 还活着，
   * 于是错误被当成真的读取失败显示出来，整个目录退化成空。端到端跑的是生产构建、
   * StrictMode 双调用在那里不会发生，因此这类回归只有组件/单元测试挡得住。
   *
   * 代价写在明处：一次列举开始之后就取消不掉了。这在这里可接受——它是只读列举，
   * 结果本来就要进缓存；而 `generation` 已经挡住了 `invalidate` / `dispose` 之后的过期写入。
   */
  async function listComponents(signal?: AbortSignal): Promise<ComposeComponentCatalog> {
    ensureActive()
    throwIfAborted(signal)
    if (catalog) return catalog
    if (catalogInFlight) {
      const shared = await catalogInFlight
      // 等的过程中本次调用方可能已经取消了：结果照旧进缓存，只是不交给它。
      throwIfAborted(signal)
      return shared
    }
    const requestGeneration = generation
    const request = (async () => {
      const folders: (readonly string[])[] = []
      const walked = (await listEntries(provider.root.id, [], folders)).filter(({ entry }) => (
        entry.kind === 'file'
        && isComposeComponentMediaType(entry.mediaType)
        && isComposeComponentFileName(entry.name)
        && entry.assetKey
      ))
      const components: ComposeComponentDescriptor[] = []
      const issues: Array<{ assetKey: string; issues: readonly ComposeComponentAssetIssue[] }> = []
      for (const { entry, folderPath } of walked) {
        try {
          const snapshot = await readEntry(entry)
          components.push({
            entryId: entry.id,
            assetKey: snapshot.assetKey,
            displayName: displayName(entry.name),
            componentId: snapshot.asset.componentId,
            kind: snapshot.asset.kind,
            revision: snapshot.revision,
            reference: referenceFor(snapshot.assetKey),
            folderPath,
          })
        }
        catch (error) {
          issues.push({
            assetKey: entry.assetKey!,
            issues: [{
              code: 'component-asset.invalid-shape',
              path: [],
              message: error instanceof Error ? error.message : String(error),
            }],
          })
        }
      }
      // assetKey 通常含随机生成段，跨会话顺序不稳定；按显示名排序让目录顺序对用户
      // 可预期，assetKey 仅作同名时的确定性 tie-break。
      components.sort((a, b) => (
        a.displayName.localeCompare(b.displayName, locale)
        || a.assetKey.localeCompare(b.assetKey, locale)
      ))
      const result = { components, issues, folders }
      if (requestGeneration === generation) catalog = result
      return result
    })()
    catalogInFlight = request
    try {
      const result = await request
      throwIfAborted(signal)
      return result
    }
    finally {
      if (catalogInFlight === request) catalogInFlight = null
    }
  }

  const findDescriptor = async (assetKey: string, signal?: AbortSignal) => {
    const result = await listComponents(signal)
    const descriptor = result.components.find((candidate) => candidate.assetKey === assetKey)
    if (!descriptor) throw new ComposeAssetError('not-found', `组件不存在：${assetKey}`)
    return descriptor
  }

  const store: ComposeComponentStore = {
    providerId: provider.id,

    createReference: referenceFor,

    listComponents,

    async readComponent(assetKey, signal) {
      ensureActive()
      throwIfAborted(signal)
      const cached = snapshots.get(assetKey)
      if (cached) return cached
      const descriptor = await findDescriptor(assetKey, signal)
      return readEntry({
        id: descriptor.entryId,
        parentId: null,
        name: descriptor.displayName,
        kind: 'file',
        mediaType: COMPOSE_COMPONENT_MEDIA_TYPE,
        assetKey,
        revision: descriptor.revision,
      }, signal)
    },

    async createComponent(createInput) {
      ensureActive()
      throwIfAborted(createInput.signal)
      if (!provider.capabilities.createFile || !provider.createFile) {
        throw new ComposeAssetError('unsupported', 'Provider 不支持创建组件文件')
      }
      const fileName = validateAssetName(composeComponentFileName(createInput.fileName))
      const content = componentBlob(createInput.asset)
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
      if (!entry.assetKey) throw new ComposeAssetError('unsupported', 'Provider 创建的组件缺少 assetKey')
      const snapshot: ComposeComponentSnapshot = {
        asset: structuredClone(createInput.asset),
        revision: entry.revision ?? '',
        entryId: entry.id,
        assetKey: entry.assetKey,
      }
      generation += 1
      snapshots.set(entry.assetKey, snapshot)
      catalog = null
      catalogInFlight = null
      emit({ type: 'catalog-changed' })
      emit({ type: 'component-changed', assetKey: entry.assetKey })
      return snapshot
    },

    async saveComponent(assetKey, asset, expectedRevision, force, signal) {
      ensureActive()
      throwIfAborted(signal)
      if (!provider.capabilities.write || !provider.writeFile) {
        throw new ComposeAssetError('unsupported', 'Provider 不支持写入组件文件')
      }
      const descriptor = await findDescriptor(assetKey, signal)
      let entry: ComposeAssetEntry
      try {
        entry = await provider.writeFile({
          fileId: descriptor.entryId,
          content: componentBlob(asset),
          expectedRevision,
          force,
          signal,
        })
      }
      catch (error) {
        throw normalizeComposeAssetError(error)
      }
      const snapshot: ComposeComponentSnapshot = {
        asset: structuredClone(asset),
        revision: entry.revision ?? expectedRevision,
        entryId: entry.id,
        assetKey,
      }
      generation += 1
      snapshots.set(assetKey, snapshot)
      catalog = null
      catalogInFlight = null
      emit({ type: 'catalog-changed' })
      emit({ type: 'component-changed', assetKey })
      return snapshot
    },

    async resolveComponent(reference, signal) {
      ensureActive()
      if (reference.providerId !== provider.id
        || reference.scope !== (provider.referenceScope ?? 'persistent')) {
        throw new ComposeAssetError('unsupported', '组件引用不属于当前 Provider 或 scope')
      }
      const current = await store.readComponent(reference.assetKey, signal)
      return resolveComposeComponentAsset({
        asset: current.asset,
        revision: current.revision,
        reference,
        signal,
        load: async (parentReference, parentSignal) => {
          const parent = await store.readComponent(parentReference.assetKey, parentSignal)
          return { asset: parent.asset, revision: parent.revision }
        },
      })
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
