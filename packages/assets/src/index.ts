/**
 * 提供与 React、文档和资源浏览 UI 无关的资源 Provider 与运行时解析协议。
 *
 * @packageDocumentation
 */

/** Provider 可独立控制的资源操作能力。 @public */
export interface ComposeAssetCapabilities {
  readonly createFile: boolean
  readonly createFolder: boolean
  readonly rename: boolean
  readonly move: boolean
  readonly delete: boolean
  readonly write: boolean
  /** 是否允许把带 assetKey 的文件引用写入 ComposeDocument。 */
  readonly reference?: boolean
}

/** 资源树中的目录或文件。 @public */
export interface ComposeAssetEntry {
  readonly id: string
  readonly parentId: string | null
  readonly name: string
  readonly kind: 'folder' | 'file'
  readonly mediaType?: string
  readonly size?: number
  readonly modifiedAt?: number
  readonly revision?: string
  /** 独立于树 ID、在 rename/move 后保持不变的资源引用键。 */
  readonly assetKey?: string
  readonly capabilities?: Partial<ComposeAssetCapabilities>
}

/** 写入 Component props 的稳定资源引用。 @public */
export interface ComposeAssetReference {
  readonly [key: string]: string
  readonly providerId: string
  readonly assetKey: string
  /** session 引用要求宿主重新连接同一运行时 Provider。 */
  readonly scope: 'persistent' | 'session'
}

/** Resolver 返回的最新资源内容。 @public */
export interface ComposeResolvedAsset {
  readonly blob: Blob
  readonly revision: string
  readonly mediaType: string
}

/** Stage 与 Preview 解析文档资源引用的运行时端口。 @public */
export interface ComposeAssetResolver {
  resolve(input: {
    readonly reference: ComposeAssetReference
    readonly signal?: AbortSignal
  }): Promise<ComposeResolvedAsset>
  subscribe?(
    reference: ComposeAssetReference,
    listener: () => void,
  ): () => void
}

/** @public */
export interface CreateFolderInput {
  readonly parentId: string
  readonly name: string
  readonly signal?: AbortSignal
}

/** @public */
export interface CreateFileInput {
  readonly parentId: string
  readonly name: string
  readonly content: Blob
  readonly signal?: AbortSignal
}

/** @public */
export interface RenameAssetInput {
  readonly entryId: string
  readonly name: string
  readonly signal?: AbortSignal
}

/** @public */
export interface MoveAssetInput {
  readonly entryId: string
  readonly parentId: string
  readonly signal?: AbortSignal
}

/** @public */
export interface DeleteAssetInput {
  readonly entryId: string
  readonly recursive?: boolean
  readonly signal?: AbortSignal
}

/** @public */
export interface WriteAssetInput {
  readonly fileId: string
  readonly content: Blob
  readonly expectedRevision: string
  readonly force?: boolean
  readonly signal?: AbortSignal
}

/** 通过不可变 assetKey 读取资源的参数。 @public */
export interface ResolveAssetInput {
  readonly assetKey: string
  readonly signal?: AbortSignal
}

/** Asset Browser 连接的异步资源事实来源。 @public */
export interface ComposeAssetProvider {
  readonly id: string
  readonly label: string
  readonly root: ComposeAssetEntry
  readonly capabilities: ComposeAssetCapabilities
  /** 当前 Provider 创建的引用持久性；省略时按 persistent 处理。 */
  readonly referenceScope?: ComposeAssetReference['scope']
  list(input: {
    readonly folderId: string
    readonly signal?: AbortSignal
  }): Promise<readonly ComposeAssetEntry[]>
  read(input: {
    readonly fileId: string
    readonly signal?: AbortSignal
  }): Promise<{ readonly blob: Blob; readonly revision: string }>
  /** 通过稳定 assetKey 读取最新内容；缺少时不可拖入 Canvas。 */
  resolveAsset?(input: ResolveAssetInput): Promise<ComposeResolvedAsset>
  createFolder?(input: CreateFolderInput): Promise<ComposeAssetEntry>
  createFile?(input: CreateFileInput): Promise<ComposeAssetEntry>
  renameEntry?(input: RenameAssetInput): Promise<ComposeAssetEntry>
  moveEntry?(input: MoveAssetInput): Promise<ComposeAssetEntry>
  deleteEntry?(input: DeleteAssetInput): Promise<void>
  writeFile?(input: WriteAssetInput): Promise<ComposeAssetEntry>
  subscribe?(listener: () => void): () => void
}

/** Provider 的稳定错误分类。 @public */
export type ComposeAssetErrorCode =
  | 'not-found'
  | 'permission-denied'
  | 'conflict'
  | 'invalid-name'
  | 'unsupported'
  | 'io'

/** Provider 和资源协调层抛出的可判别错误。 @public */
export class ComposeAssetError extends Error {
  readonly code: ComposeAssetErrorCode
  readonly cause?: unknown

  constructor(
    code: ComposeAssetErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message)
    this.name = 'ComposeAssetError'
    this.code = code
    this.cause = options?.cause
  }
}

/** 多项资源操作中的单项结果。 @public */
export type ComposeAssetItemResult<T> =
  | { readonly status: 'fulfilled'; readonly item: T; readonly value: ComposeAssetEntry | void }
  | { readonly status: 'rejected'; readonly item: T; readonly error: ComposeAssetError }

/** 多项资源操作完成后的精确汇总。 @public */
export interface ComposeAssetBatchResult<T> {
  readonly succeeded: number
  readonly failed: number
  readonly results: readonly ComposeAssetItemResult<T>[]
}

/** 宿主审计资源操作时接收的事件。 @public */
export interface ComposeAssetOperationEvent {
  readonly type: 'create' | 'import' | 'rename' | 'move' | 'delete' | 'write'
  readonly entryIds: readonly string[]
  readonly succeeded: number
  readonly failed: number
}

const domErrorCodes: Readonly<Record<string, ComposeAssetErrorCode>> = {
  AbortError: 'io',
  NotAllowedError: 'permission-denied',
  NotFoundError: 'not-found',
  NoModificationAllowedError: 'permission-denied',
  SecurityError: 'permission-denied',
  TypeMismatchError: 'unsupported',
}

/** 将任意 Provider/DOM 异常规范化为稳定资源错误。 @public */
export function normalizeComposeAssetError(error: unknown): ComposeAssetError {
  if (error instanceof ComposeAssetError) return error
  const name = error instanceof DOMException
    ? error.name
    : typeof error === 'object' && error && 'name' in error
      ? String(error.name)
      : ''
  const message = error instanceof Error ? error.message : 'Asset operation failed'
  return new ComposeAssetError(domErrorCodes[name] ?? 'io', message, { cause: error })
}

/** 逐项执行异步资源操作并保留部分成功结果。 @public */
export async function executeAssetBatch<T>(
  items: readonly T[],
  operation: (item: T) => Promise<unknown>,
): Promise<ComposeAssetBatchResult<T>> {
  const results: ComposeAssetItemResult<T>[] = []
  for (const item of items) {
    try {
      const value = await operation(item)
      results.push({
        status: 'fulfilled',
        item,
        value: value as ComposeAssetEntry | void,
      })
    } catch (error) {
      results.push({
        status: 'rejected',
        item,
        error: normalizeComposeAssetError(error),
      })
    }
  }
  const succeeded = results.filter((result) => result.status === 'fulfilled').length
  return { succeeded, failed: results.length - succeeded, results }
}

/** 校验文件或目录名称，拒绝空白、路径和系统目录标记。 @public */
export function validateAssetName(name: string) {
  const normalized = name.trim()
  if (
    normalized.length === 0
    || normalized === '.'
    || normalized === '..'
    || /[\\/]/u.test(normalized)
    || normalized.includes('\0')
  ) {
    throw new ComposeAssetError('invalid-name', `Invalid asset name: ${name}`)
  }
  return normalized
}

/**
 * 把单个 Provider 适配为 Stage/Preview resolver。
 *
 * @throws Provider 未声明引用能力或缺少 resolveAsset 时抛出 unsupported。
 * @public
 */
export function createComposeAssetResolver(
  provider: ComposeAssetProvider,
): ComposeAssetResolver {
  if (!provider.capabilities.reference || !provider.resolveAsset) {
    throw new ComposeAssetError(
      'unsupported',
      `Asset provider "${provider.id}" does not support stable references`,
    )
  }
  return {
    async resolve({ reference, signal }) {
      if (reference.providerId !== provider.id) {
        throw new ComposeAssetError(
          'not-found',
          `Asset provider "${reference.providerId}" is not connected`,
        )
      }
      try {
        return await provider.resolveAsset?.({
          assetKey: reference.assetKey,
          signal,
        }) as ComposeResolvedAsset
      } catch (error) {
        throw normalizeComposeAssetError(error)
      }
    },
    subscribe(reference, listener) {
      if (reference.providerId !== provider.id) return () => undefined
      return provider.subscribe?.(listener) ?? (() => undefined)
    },
  }
}
