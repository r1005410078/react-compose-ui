import {
  composeAnimationFileName,
  createComposeAnimationFile,
  parseComposeAnimationFile,
  serializeComposeAnimationFile,
  COMPOSE_ANIMATION_MEDIA_TYPE,
  type ComposeAnimationFile,
} from '@compose-ui/animation'
import {
  ComposeAssetError,
  normalizeComposeAssetError,
  type ComposeAssetEntry,
  type ComposeAssetProvider,
} from '@compose-ui/assets'
import type { ComposeAnimation, ComposePageAnimationReference } from '@compose-ui/core'

/** 动画文件的一次读取或写入快照。 @internal */
export interface PageAnimationSnapshot {
  readonly file: ComposeAnimationFile
  /** Provider 条目 ID，写回时作为 `writeFile.fileId` 使用。 */
  readonly entryId: string
  /** 最近一次读写得到的文件 revision，用于乐观并发。 */
  readonly revision: string
}

/**
 * 在页面同目录中按稳定 assetKey 找到动画文件条目。
 *
 * @remarks
 * 动画文件与页面同目录是编辑器的创建约定；引用本身只含 assetKey，写回需要条目 ID，
 * 因此通过目录列举反查。找不到按 `not-found` 报告，让调用方呈现「动画文件已被移走」。
 */
async function findAnimationEntry(
  provider: ComposeAssetProvider,
  parentId: string,
  assetKey: string,
  signal?: AbortSignal,
): Promise<ComposeAssetEntry> {
  let entries: readonly ComposeAssetEntry[]
  try {
    entries = await provider.list({ folderId: parentId, signal })
  }
  catch (error) {
    throw normalizeComposeAssetError(error)
  }
  const found = entries.find((entry) => entry.kind === 'file' && entry.assetKey === assetKey)
  if (!found) {
    throw new ComposeAssetError('not-found', `动画文件不存在：${assetKey}`)
  }
  return found
}

/**
 * 读取并解析页面绑定的动画文件。
 *
 * @throws {@link @compose-ui/assets#ComposeAssetError} 文件缺失、不可读或内容不合法时抛出。
 * @internal
 */
export async function loadPageAnimation(
  provider: ComposeAssetProvider,
  parentId: string,
  reference: ComposePageAnimationReference,
  signal?: AbortSignal,
): Promise<PageAnimationSnapshot> {
  const entry = await findAnimationEntry(provider, parentId, reference.assetKey, signal)
  let text: string
  let revision: string
  try {
    const read = await provider.read({ fileId: entry.id, signal })
    text = await read.blob.text()
    revision = read.revision
  }
  catch (error) {
    throw normalizeComposeAssetError(error)
  }
  const parsed = parseComposeAnimationFile(text)
  if (!parsed.ok) {
    throw new ComposeAssetError(
      'io',
      `动画文件内容不合法：${parsed.issues[0]?.message ?? '未知原因'}`,
    )
  }
  return { file: parsed.file, entryId: entry.id, revision }
}

/**
 * 在页面同目录创建动画文件资产。
 *
 * @remarks
 * 文件名按显示名规范化；同名冲突时追加序号重试，而不是覆盖已有资产。
 * 创建成功但缺少稳定 assetKey 时按 `unsupported` 报告——没有稳定引用的动画无法绑定。
 * @internal
 */
export async function createPageAnimationFile(
  provider: ComposeAssetProvider,
  parentId: string,
  displayName: string,
  frameId: string,
  animation: Pick<ComposeAnimation, 'id' | 'name'> & Partial<ComposeAnimation>,
  signal?: AbortSignal,
): Promise<{ readonly entry: ComposeAssetEntry; readonly file: ComposeAnimationFile }> {
  const createFile = provider.createFile
  if (!createFile || provider.capabilities.createFile === false) {
    throw new ComposeAssetError('unsupported', '当前 Provider 不支持创建动画文件')
  }
  const file = createComposeAnimationFile(frameId, animation)
  const content = new Blob(
    [serializeComposeAnimationFile(file)],
    { type: COMPOSE_ANIMATION_MEDIA_TYPE },
  )
  let lastError: ComposeAssetError | undefined
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const name = composeAnimationFileName(
      attempt === 0 ? displayName : `${displayName} ${attempt + 1}`,
    )
    try {
      const entry = await createFile.call(provider, { parentId, name, content, signal })
      if (!entry.assetKey) {
        throw new ComposeAssetError('unsupported', '动画文件缺少稳定 assetKey，无法绑定到页面')
      }
      return { entry, file }
    }
    catch (error) {
      const normalized = normalizeComposeAssetError(error)
      if (normalized.code !== 'conflict') throw normalized
      lastError = normalized
    }
  }
  throw lastError ?? new ComposeAssetError('conflict', '动画文件名持续冲突')
}

/**
 * 把整份动画文件写回资产。
 *
 * @remarks
 * 一份文件承载多块场景的分区，因此写回的单位是**整份文件**而不是单条清单：调用方先把各
 * Frame 的镜像合并进文件再交给这里，一次保存对同一份文件只写一次。
 * 用调用方持有的文件 revision 做乐观并发；`conflict` 由调用方决定提示或强制覆盖。
 * @internal
 */
export async function writePageAnimationFile(
  provider: ComposeAssetProvider,
  entryId: string,
  file: ComposeAnimationFile,
  expectedRevision: string,
  force?: boolean,
): Promise<{ readonly revision: string }> {
  const writeFile = provider.writeFile
  if (!writeFile || provider.capabilities.write === false) {
    throw new ComposeAssetError('unsupported', '当前 Provider 不支持写入动画文件')
  }
  let entry: ComposeAssetEntry
  try {
    entry = await writeFile.call(provider, {
      fileId: entryId,
      content: new Blob(
        [serializeComposeAnimationFile(file)],
        { type: COMPOSE_ANIMATION_MEDIA_TYPE },
      ),
      expectedRevision,
      force,
    })
  }
  catch (error) {
    throw normalizeComposeAssetError(error)
  }
  return { revision: entry.revision ?? '' }
}
