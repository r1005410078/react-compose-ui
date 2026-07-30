import type {
  ComposeAssetCanvasDragItem,
  ComposeAssetReferenceDragPayload,
} from './asset-browser-types'

function isDragItem(value: unknown): value is ComposeAssetCanvasDragItem {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  const reference = candidate.reference as Record<string, unknown> | undefined
  return typeof candidate.name === 'string'
    && typeof candidate.mediaType === 'string'
    && typeof reference === 'object'
    && reference !== null
    && typeof reference.providerId === 'string'
    && typeof reference.assetKey === 'string'
    && (reference.scope === 'persistent' || reference.scope === 'session')
}

/**
 * 解析资源浏览器写入的稳定引用拖拽载荷。
 *
 * @returns 载荷缺失、非法或版本不受支持时返回空数组，调用方据此忽略该次拖拽。
 * @public
 */
export function parseComposeAssetReferenceDragData(
  text: string,
): readonly ComposeAssetCanvasDragItem[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  }
  catch {
    return []
  }
  if (typeof parsed !== 'object' || parsed === null) return []
  const payload = parsed as Partial<ComposeAssetReferenceDragPayload>
  if (payload.version !== 1 || !Array.isArray(payload.items)) return []
  return payload.items.filter(isDragItem)
}
