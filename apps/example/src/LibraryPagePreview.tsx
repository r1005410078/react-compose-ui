import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposePageFile } from '@compose-ui/core'
import type { ComposePageStore } from '@compose-ui/pages'
import { ComposePreview } from '@compose-ui/preview'
import { useEffect, useState } from 'react'

/**
 * 页面库全屏演示里的那一张真实画面。
 *
 * @remarks
 * 演示的是**真实渲染而不是缩略图**：客户要凑近看数值与线宽。因此它就是既有的只读
 * `ComposePreview`——另写一份的话，「演示时好好的、上了大屏不一样」这类问题永远查不清是谁的。
 *
 * 渲染器由宿主注入而不是由编辑器自带：`editor` 与 `preview` 是同一层的两个入口包，谁也不该
 * 依赖谁。这与缩略图的 `renderThumbnail` 是同一条判断。
 *
 * `fit` 取 `cover`：场景**就是那块屏的全部内容**，`contain` 会在两条边留出演示时本不该有的
 * 台面。
 *
 * 读回来的那一份**连它是哪一页一起记**：翻到下一张时上一张的结果可能还在路上，只记 page
 * 会让那一帧画的是上一张。迟到的结果另由一位 `disposed` 挡掉。
 */
export function LibraryPagePreview({
  pageKey,
  store,
  registry,
  assetResolver,
}: {
  readonly pageKey: string
  readonly store: ComposePageStore
  readonly registry: ComposeEntityRegistry
  readonly assetResolver: ComposeAssetResolver
}) {
  const [loaded, setLoaded] = useState<{
    readonly pageKey: string
    readonly page: ComposePageFile
  } | null>(null)

  useEffect(() => {
    let disposed = false
    void store.readPage(pageKey).then((snapshot) => {
      if (!disposed) setLoaded({ pageKey, page: snapshot.page })
    }).catch(() => undefined)
    return () => { disposed = true }
  }, [pageKey, store])

  const page = loaded?.pageKey === pageKey ? loaded.page : null
  if (page === null) return null

  return (
    <ComposePreview
      assetResolver={assetResolver}
      document={page.document}
      fit="cover"
      page={page}
      registry={registry}
      {...(page.activeFrameId === null ? {} : { frameId: page.activeFrameId })}
    />
  )
}
