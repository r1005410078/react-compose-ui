import type { ComposePageReference } from './page-types'

/**
 * 从任意值读取页面引用。
 *
 * @returns 值是完整页面引用时返回该引用，否则返回 null。
 * @remarks
 * 字段缺失、类型不符或 `kind` 不是 `'page'` 都视为不是页面引用，因此可直接用于校验从文档
 * 读出的 Renderer props。
 * @public
 */
export function readComposePageReference(value: unknown): ComposePageReference | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Record<string, unknown>
  if (candidate.kind !== 'page') return null
  if (typeof candidate.providerId !== 'string' || candidate.providerId.length === 0) return null
  if (typeof candidate.assetKey !== 'string' || candidate.assetKey.length === 0) return null
  if (candidate.scope !== 'persistent' && candidate.scope !== 'session') return null
  return {
    kind: 'page',
    providerId: candidate.providerId,
    assetKey: candidate.assetKey,
    scope: candidate.scope,
  }
}
