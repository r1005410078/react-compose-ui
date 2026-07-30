import {
  COMPOSE_ASSET_REFERENCE_DRAG_MEDIA_TYPE,
  parseComposeAssetReferenceDragData,
} from '@compose-ui/asset-browser'
import type { ComposeNodeEditPort } from '@compose-ui/component-registry'
import { isComposePageMediaType, readComposePageReference } from '@compose-ui/core'
import type { ComposePageCatalog, ComposePageDescriptor } from '@compose-ui/pages'
import { useMemo } from 'react'


/** 资源浏览器内部移动使用的条目 ID 载荷。 */
const ASSET_ID_DRAG_MEDIA_TYPE = 'application/x-compose-asset-ids'

function referenceOf(descriptor: ComposePageDescriptor, providerId: string, scope: 'persistent' | 'session') {
  return {
    kind: 'page' as const,
    providerId,
    assetKey: descriptor.pageKey,
    scope,
  }
}

/**
 * 把页面目录桥接为属性面板 node editor 的候选来源。
 *
 * @remarks
 * `parseDrop` 优先解析稳定引用载荷；只有它缺失时才回退到用目录把条目 ID 映射为页面 key ——
 * 条目 ID 跨重命名与移动不稳定，只能作为兜底。
 * @internal
 */
export function useNodeEditorPort({
  catalog,
  labels,
  providerId,
  scope = 'persistent',
}: {
  readonly catalog: ComposePageCatalog | undefined
  /** 无法解析引用时的占位文案；省略时使用内建中文。 */
  readonly labels?: {
    readonly invalidReference?: string
    readonly missingPage?: (pageKey: string) => string
  }
  readonly providerId: string | undefined
  readonly scope?: 'persistent' | 'session'
}): ComposeNodeEditPort | undefined {
  const invalidReference = labels?.invalidReference
  const missingPage = labels?.missingPage
  return useMemo(() => {
    if (providerId === undefined || catalog === undefined) return undefined
    const byKey = new Map(catalog.pages.map((page) => [page.pageKey, page]))
    const byEntryId = new Map(catalog.pages.map((page) => [page.entryId, page]))
    const candidateOf = (descriptor: ComposePageDescriptor) => ({
      id: descriptor.pageKey,
      label: descriptor.displayName,
      value: referenceOf(descriptor, providerId, scope),
    })
    return {
      dragMediaTypes: [COMPOSE_ASSET_REFERENCE_DRAG_MEDIA_TYPE, ASSET_ID_DRAG_MEDIA_TYPE],
      candidates: catalog.pages.map(candidateOf),
      parseDrop: (data) => {
        const referenceText = data[COMPOSE_ASSET_REFERENCE_DRAG_MEDIA_TYPE]
        if (referenceText !== undefined) {
          const item = parseComposeAssetReferenceDragData(referenceText)
            .find((candidate) => isComposePageMediaType(candidate.mediaType)
              && candidate.reference.providerId === providerId)
          const descriptor = item ? byKey.get(item.reference.assetKey) : undefined
          if (descriptor) return candidateOf(descriptor)
          // 引用载荷存在但不是本 Provider 的页面：明确拒绝，不再退回 ID 载荷。
          if (item !== undefined || referenceText.length > 0) return null
        }
        const ids = data[ASSET_ID_DRAG_MEDIA_TYPE]
        if (ids === undefined) return null
        const descriptor = ids.split('\n')
          .map((id) => byEntryId.get(id))
          .find((candidate): candidate is ComposePageDescriptor => candidate !== undefined)
        return descriptor ? candidateOf(descriptor) : null
      },
      resolveLabel: (value) => {
        const reference = readComposePageReference(value)
        if (!reference) return invalidReference ?? '无效的页面引用'
        const descriptor = byKey.get(reference.assetKey)
        if (descriptor) return descriptor.displayName
        return missingPage?.(reference.assetKey)
          ?? `已删除的页面 (${reference.assetKey})`
      },
    }
  }, [catalog, invalidReference, missingPage, providerId, scope])
}
