import type { ComposePageNestState, ComposePageReference } from './page-types'

/**
 * 页面嵌套渲染的深度上限。
 *
 * @remarks
 * 取 8 是因为深度乘以扇出直接决定嵌套渲染的挂载量，而本阶段没有虚拟化；8 层足以覆盖
 * 「页面套区块套卡片」这类真实结构，同时把最坏情况的挂载规模限制在可接受范围。
 * @public
 */
export const COMPOSE_PAGE_NEST_DEPTH_LIMIT = 8

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

/** {@link resolveComposePageNestState} 的输入。 @public */
export interface ResolveComposePageNestStateInput {
  /** 待渲染页面的稳定资源 key。 */
  readonly pageKey: string
  /** 由外层向内层排列的祖先页面 key；不含 `pageKey` 自身。 */
  readonly ancestorPageKeys: readonly string[]
  /** @defaultValue {@link COMPOSE_PAGE_NEST_DEPTH_LIMIT} */
  readonly depthLimit?: number
}

/**
 * 判定一次页面嵌套是否可以继续加载。
 *
 * @remarks
 * 循环检测优先于深度检测：同一个页面重复出现在祖先链中一定是引用错误，即使深度尚未超限也必须
 * 阻断，否则会无限递归。深度以祖先链长度表达，因此根页面下的第一层嵌套深度为 0。
 * @public
 */
export function resolveComposePageNestState(
  input: ResolveComposePageNestStateInput,
): ComposePageNestState {
  if (input.ancestorPageKeys.includes(input.pageKey)) return 'cycle'
  const depthLimit = input.depthLimit ?? COMPOSE_PAGE_NEST_DEPTH_LIMIT
  return input.ancestorPageKeys.length >= depthLimit ? 'depth-exceeded' : 'ok'
}
