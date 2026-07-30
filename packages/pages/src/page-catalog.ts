import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import { ComposeAssetError, normalizeComposeAssetError } from '@compose-ui/assets'
import { composePageDisplayName, isComposePageMediaType } from '@compose-ui/core'

/** 目录中一个页面的稳定描述。 @public */
export interface ComposePageDescriptor {
  /**
   * 页面的稳定资源 key。
   *
   * @remarks
   * 取自 `ComposeAssetEntry.assetKey`，跨重命名与移动保持不变，因此可安全写入清单与文档引用。
   */
  readonly pageKey: string
  /** 当前的资源条目 ID；重命名或移动后可能变化，不得持久化。 */
  readonly entryId: string
  /** 含页面后缀的文件名。 */
  readonly fileName: string
  /** 去掉页面后缀的用户可见名称。 */
  readonly displayName: string
  readonly parentId: string | null
  readonly revision?: string
  readonly modifiedAt?: number
}

/**
 * 递归列举 Provider 目录树中的全部页面。
 *
 * @remarks
 * 只按名称后缀过滤，不读取文件内容，因此列举一棵大目录树不会产生任何页面文档读取。
 * 缺少 `assetKey` 的页面文件被跳过 —— 没有稳定 key 就无法被引用或设为首页，纳入目录只会
 * 在下游产生无法解析的引用。
 * 结果按目录路径与文件名排序，使目录展示顺序稳定。
 *
 * @param locale - 文件名排序使用的语言标签。
 * @throws {@link @compose-ui/assets#ComposeAssetError} Provider 列举失败时抛出归一化错误。
 * @public
 */
export async function listComposePageDescriptors(input: {
  readonly provider: ComposeAssetProvider
  readonly locale?: string
  readonly signal?: AbortSignal
}): Promise<readonly ComposePageDescriptor[]> {
  const { provider, signal } = input
  const locale = input.locale ?? 'en'
  const descriptors: ComposePageDescriptor[] = []
  // 广度优先遍历，逐层等待；页面目录规模有限，逐层顺序列举比并发更容易保证取消语义。
  const pending: string[] = [provider.root.id]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const folderId = pending.shift()
    if (folderId === undefined || visited.has(folderId)) continue
    visited.add(folderId)
    if (signal?.aborted === true) {
      throw new ComposeAssetError('io', '页面列举已取消', { cause: signal.reason })
    }
    let entries: readonly ComposeAssetEntry[]
    try {
      entries = await provider.list({ folderId, signal })
    }
    catch (error) {
      throw normalizeComposeAssetError(error)
    }
    entries.forEach((entry) => {
      if (entry.kind === 'folder') {
        pending.push(entry.id)
        return
      }
      // 身份判据是 Provider 上报的媒体类型，不是文件名。
      if (!isComposePageMediaType(entry.mediaType) || !entry.assetKey) return
      descriptors.push({
        pageKey: entry.assetKey,
        entryId: entry.id,
        fileName: entry.name,
        displayName: composePageDisplayName(entry.name),
        parentId: entry.parentId,
        revision: entry.revision,
        modifiedAt: entry.modifiedAt,
      })
    })
  }
  return descriptors.sort((left, right) => left.pageKey.localeCompare(
    right.pageKey,
    locale,
    { numeric: true, sensitivity: 'base' },
  ))
}
