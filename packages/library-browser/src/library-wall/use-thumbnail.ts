import type { ComposeLibraryPort, ComposeLibraryRecord } from '@compose-ui/library'
import { useEffect, useState } from 'react'

/**
 * 取一张缩略图能用的 `src`。
 *
 * @remarks
 * 两条路，与 `ComposeAssetProvider` 的 `resolveUrl` / `resolveAsset` 分工逐字相同：
 *
 * - 记录上带 `thumbnailUrl`（服务端签的直接 URL）就直接用它，**不产生任何生命周期**。
 * - 否则走 `port.readThumbnail` 拿字节，在**这里**合成 objectURL 并在卸载或换图时释放——
 *   objectURL 的归属只能在认识 DOM 的这一层，headless 的端口里合成它就是一处没人释放的泄漏。
 *
 * 两条都拿不到时返回 `null`，由调用方画占位：**没有图是常态，不是失败**。
 *
 * `record` 可以为 `null`（新建页面那一档没有底图），此时恒返回 `null`——Hook 不能按条件调用，
 * 而调用方那一侧「有没有底图」正是一个条件。
 * @internal
 */
export function useThumbnail(port: ComposeLibraryPort, record: ComposeLibraryRecord | null) {
  const pageKey = record?.pageKey ?? null
  const thumbnailUrl = record?.thumbnailUrl ?? null
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (thumbnailUrl !== null || pageKey === null) return
    const read = port.readThumbnail
    if (!read) return
    let revoked = false
    let created: string | null = null
    void read.call(port, { pageKey }).then((result) => {
      if (result === null) return
      // 迟到的结果落在已经卸载的组件上时立刻释放，不要塞进 state。
      const url = URL.createObjectURL(result.blob)
      if (revoked) {
        URL.revokeObjectURL(url)
        return
      }
      created = url
      setObjectUrl(url)
    }).catch(() => undefined)
    return () => {
      revoked = true
      setObjectUrl(null)
      if (created !== null) URL.revokeObjectURL(created)
    }
  }, [pageKey, port, thumbnailUrl])

  return thumbnailUrl ?? objectUrl
}
